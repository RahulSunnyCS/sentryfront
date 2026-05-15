/**
 * APK/IPA analysis utilities.
 * Uses system `unzip` (available on Linux) to extract archives without
 * adding npm dependencies.  All public methods are pure (no side effects
 * beyond the temp dir created via extractApk / extractIpa).
 */

import { spawnSync } from 'child_process';
import {
  mkdtempSync,
  rmSync,
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export interface ApkContents {
  /** Temp directory; caller must call cleanup() when done. */
  dir: string;
  cleanup: () => void;
  /** All extracted file paths relative to dir */
  files: string[];
  /** Raw bytes of AndroidManifest.xml (binary AXML), or null if absent */
  manifestBytes: Buffer | null;
  /** Raw text of res/xml/network_security_config.xml, or null */
  networkSecurityConfig: string | null;
  /** All text-readable file contents keyed by relative path */
  textFiles: Map<string, string>;
}

// Extensions we'll read as text for secret scanning
const TEXT_EXTENSIONS = new Set([
  '.java', '.kt', '.xml', '.json', '.properties',
  '.txt', '.gradle', '.yaml', '.yml', '.ini', '.config',
  '.plist', '.strings', '.js', '.ts', '.html', '.htm', '.smali',
]);

// Max individual file size to scan (to avoid OOM on large dex files)
const MAX_TEXT_SCAN_BYTES = 2 * 1024 * 1024; // 2 MB

function walkDir(dir: string, base = dir): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const rel = full.slice(base.length + 1);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          results.push(...walkDir(full, base));
        } else {
          results.push(rel);
        }
      } catch { /* skip unreadable entries */ }
    }
  } catch { /* dir unreadable */ }
  return results;
}

function isTextFile(relPath: string): boolean {
  const lower = relPath.toLowerCase();
  for (const ext of TEXT_EXTENSIONS) {
    if (lower.endsWith(ext)) return true;
  }
  return false;
}

export function extractApk(buffer: Buffer): ApkContents {
  const tmpDir = mkdtempSync(join(tmpdir(), 'vibesafe-apk-'));
  const apkPath = join(tmpDir, '_input.apk');

  // Write buffer to temp file
  require('fs').writeFileSync(apkPath, buffer);

  // Extract with unzip (-q quiet, -o overwrite)
  spawnSync('unzip', ['-q', '-o', apkPath, '-d', tmpDir], {
    timeout: 30_000,
    maxBuffer: 50 * 1024 * 1024,
  });

  const files = walkDir(tmpDir).filter((f) => f !== '_input.apk');

  const manifestBytes = (() => {
    const mp = join(tmpDir, 'AndroidManifest.xml');
    return existsSync(mp) ? readFileSync(mp) : null;
  })();

  const networkSecurityConfig = (() => {
    const p = join(tmpDir, 'res', 'xml', 'network_security_config.xml');
    if (!existsSync(p)) return null;
    try { return readFileSync(p, 'utf-8'); } catch { return null; }
  })();

  const textFiles = new Map<string, string>();
  for (const rel of files) {
    if (!isTextFile(rel)) continue;
    const full = join(tmpDir, rel);
    try {
      const st = statSync(full);
      if (st.size > MAX_TEXT_SCAN_BYTES) continue;
      textFiles.set(rel, readFileSync(full, 'utf-8'));
    } catch { /* skip */ }
  }

  return {
    dir: tmpDir,
    cleanup: () => { try { rmSync(tmpDir, { recursive: true, force: true }); } catch {} },
    files,
    manifestBytes,
    networkSecurityConfig,
    textFiles,
  };
}

// ─── Binary AXML helpers ──────────────────────────────────────────────────────

/**
 * Parse the string pool from an Android binary XML (AXML) buffer.
 * Returns an array of strings indexed by their pool index.
 */
export function parseAxmlStrings(buf: Buffer): string[] {
  if (buf.length < 32) return [];

  // AXML starts with chunk type 0x0003 (XML), then file size
  // String pool chunk starts at offset 8
  const SP_OFFSET = 8;
  if (buf.readUInt16LE(SP_OFFSET) !== 0x0001) return []; // not STRING_POOL_TYPE

  const stringCount = buf.readUInt32LE(SP_OFFSET + 8);
  if (stringCount === 0 || stringCount > 100_000) return [];

  const flags = buf.readUInt32LE(SP_OFFSET + 16);
  const stringsStart = buf.readUInt32LE(SP_OFFSET + 20);
  const isUTF8 = (flags & 0x00000100) !== 0;

  const offsetsBase = SP_OFFSET + 28;
  const strDataBase = SP_OFFSET + stringsStart;

  const result: string[] = [];
  for (let i = 0; i < stringCount; i++) {
    const relOff = buf.readUInt32LE(offsetsBase + i * 4);
    const offset = strDataBase + relOff;
    if (offset >= buf.length) { result.push(''); continue; }

    try {
      if (isUTF8) {
        let pos = offset;
        // UTF-8: encoded char count (1-2 bytes), encoded byte count (1-2 bytes), bytes
        let charLen = buf[pos++];
        if (charLen & 0x80) { charLen = ((charLen & 0x7f) << 8) | buf[pos++]; }
        let byteLen = buf[pos++];
        if (byteLen & 0x80) { byteLen = ((byteLen & 0x7f) << 8) | buf[pos++]; }
        result.push(buf.subarray(pos, pos + byteLen).toString('utf8'));
      } else {
        let pos = offset;
        let charLen = buf.readUInt16LE(pos); pos += 2;
        if (charLen & 0x8000) {
          charLen = ((charLen & 0x7fff) << 16) | buf.readUInt16LE(pos);
          pos += 2;
        }
        result.push(buf.subarray(pos, pos + charLen * 2).toString('utf16le'));
      }
    } catch { result.push(''); }
  }
  return result;
}

/**
 * Known Android attribute resource IDs (fixed by the framework).
 * These appear as the `name` field in AXML attribute records when
 * the attribute belongs to the android: namespace.
 */
export const ANDROID_ATTR = {
  debuggable:            0x0101021b,
  allowBackup:           0x01010280,
  usesCleartextTraffic:  0x010104ec,
  exported:              0x01010003,
  name:                  0x01010003, // also 'name' attribute on uses-permission
  permission:            0x01010006,
} as const;

/**
 * Search for an AXML attribute with the given resource-ID `name` field
 * that has a boolean value of `true` (dataType=0x12, data≠0).
 *
 * Attribute record layout (20 bytes):
 *   0-3:  namespace resource-id
 *   4-7:  name (resource-id OR string-pool index)
 *   8-11: rawValue (string-pool index, or 0xFFFFFFFF)
 *  12-13: Res_value.size = 0x0008
 *  14:    Res_value.res0 = 0x00
 *  15:    Res_value.dataType
 *  16-19: Res_value.data
 */
export function isAxmlAttrTrue(buf: Buffer, attrResourceId: number): boolean {
  const b0 = attrResourceId & 0xff;
  const b1 = (attrResourceId >> 8) & 0xff;
  const b2 = (attrResourceId >> 16) & 0xff;
  const b3 = (attrResourceId >> 24) & 0xff;

  for (let i = 4; i <= buf.length - 20; i++) {
    if (buf[i] !== b0 || buf[i + 1] !== b1 || buf[i + 2] !== b2 || buf[i + 3] !== b3) continue;
    // Verify Res_value header: size=0x0008, res0=0x00, dataType=0x12 (boolean)
    if (buf[i + 8] !== 0x08 || buf[i + 9] !== 0x00 || buf[i + 10] !== 0x00) continue;
    if (buf[i + 11] !== 0x12) continue;
    // data ≠ 0 → boolean true
    if (buf[i + 12] !== 0 || buf[i + 13] !== 0 || buf[i + 14] !== 0 || buf[i + 15] !== 0) {
      return true;
    }
  }
  return false;
}
