/**
 * Client-side library detector backed by retire.js's signature database.
 *
 * Signatures are loaded by `retire-cache.ts` — fresh copy fetched from
 * the RetireJS GitHub repo at scan time, cached in-process for 24h, with
 * the vendored snapshot under ./data/ as the cold-start / outage fallback.
 *
 * We run the four signal types we can evaluate purely from a Chunk record:
 *   - URI regex      (against the chunk URL)
 *   - filename regex (against the URL basename)
 *   - filecontent regex (against the first 8 KB of the chunk body)
 *   - SHA-1 hash     (against the full chunk body)
 *
 * Retire's `func` (runtime expression) and `ast` (AST XPath) extractors are
 * intentionally skipped — they require executing the chunk or parsing it
 * to an AST, neither of which we want to do during a passive scan.
 *
 * §§version§§ is retire's placeholder for the version capture group; we
 * substitute it with the same character class retire itself uses.
 *
 * FP guards documented inline at each guard site.
 */
import { createHash } from 'crypto';
import { loadJsRepository, type JsRepository, type SignatureEntry } from './retire-cache';

const VERSION_PATTERN = '[0-9][0-9.a-z_\\-]+';
const CONTENT_SCAN_BYTES = 8 * 1024;

export interface Chunk {
  url: string;
  content: string;
}

export interface DetectedComponent {
  library: string;        // 'jquery'
  version: string;        // '1.4.4'
  chunkUrl: string;
  detection: 'uri' | 'filename' | 'filecontent' | 'hash';
  // Pre-resolved metadata for downstream OSV lookups + finding emission.
  // We do *not* derive severity here — that's the module's job.
  npmName: string;        // 'jquery' (falls back to library name)
}

// Pre-compile per-library regex tables so detection across N chunks is fast.
interface CompiledLibrary {
  name: string;
  npmName: string;
  uri: RegExp[];
  filename: RegExp[];
  content: RegExp[];
  hashes: Map<string, string>;     // sha1 → version
}

function substituteVersion(source: string): string {
  return source.replace(/§§version§§/g, VERSION_PATTERN);
}

function compileRegex(source: string): RegExp | null {
  try {
    return new RegExp(substituteVersion(source));
  } catch {
    return null;
  }
}

function compileLibrary(name: string, entry: SignatureEntry): CompiledLibrary | null {
  if (!entry.extractors) return null;
  const e = entry.extractors;
  return {
    name,
    npmName: entry.npmname ?? name,
    uri: (e.uri ?? []).map(compileRegex).filter((r): r is RegExp => r !== null),
    filename: (e.filename ?? []).map(compileRegex).filter((r): r is RegExp => r !== null),
    content: [...(e.filecontent ?? []), ...(e.filecontentreplace ?? [])]
      .map(compileRegex)
      .filter((r): r is RegExp => r !== null),
    hashes: new Map(Object.entries(e.hashes ?? {})),
  };
}

// In-process cache for the *compiled* tables. Keyed by reference identity of
// the source JsRepository object, so a refresh in retire-cache.ts (new object
// returned) transparently triggers recompilation here.
let compiledFor: { source: JsRepository; libraries: CompiledLibrary[] } | null = null;

function compileAll(repo: JsRepository): CompiledLibrary[] {
  return Object.entries(repo)
    // The retire-example entry is for retire's own tests; never useful.
    .filter(([name]) => name !== 'retire-example')
    .map(([name, entry]) => compileLibrary(name, entry))
    .filter((c): c is CompiledLibrary => c !== null);
}

async function getCompiled(): Promise<CompiledLibrary[]> {
  const repo = await loadJsRepository();
  if (!compiledFor || compiledFor.source !== repo) {
    compiledFor = { source: repo, libraries: compileAll(repo) };
  }
  return compiledFor.libraries;
}

// FP guard #1: libraries whose URL/filename signatures are too loose and
// frequently misfire (e.g. AngularJS 1.x firing on Angular 2+ paths).
// These require a content match — URL alone is not enough.
const URL_MATCH_NOT_TRUSTED = new Set<string>(['angularjs']);

// FP guard #4: avoid double-reporting parent + child library variants from
// the same chunk (e.g. jquery-migrate triggers jquery's content regex).
// Map of library → parent. If parent matched the same chunk, drop child.
const CHILD_OF: Record<string, string> = {
  'jquery.migrate': 'jquery',
  'jquery-ui': 'jquery',
  'jquery-mobile': 'jquery',
};

function basename(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').pop();
    return last ?? url;
  } catch {
    return url;
  }
}

function sha1(content: string): string {
  return createHash('sha1').update(content).digest('hex');
}

function detectComponentsInner(chunk: Chunk, compiled: CompiledLibrary[]): DetectedComponent[] {
  const url = chunk.url;
  const file = basename(url);
  const head = chunk.content.slice(0, CONTENT_SCAN_BYTES);
  const fullHash = chunk.content ? sha1(chunk.content) : '';

  // Per-library best match, indexed so we drop child libs whose parent matched.
  const perLibrary = new Map<string, DetectedComponent>();

  for (const lib of compiled) {
    let best: DetectedComponent | null = null;

    // Hash match is the most specific — try first.
    if (fullHash && lib.hashes.has(fullHash)) {
      const version = lib.hashes.get(fullHash)!;
      best = { library: lib.name, npmName: lib.npmName, version, chunkUrl: url, detection: 'hash' };
    }

    // Content match is next best (cheaper FPs than URI).
    if (!best) {
      for (const re of lib.content) {
        const m = head.match(re);
        if (m && m[1]) {
          best = {
            library: lib.name,
            npmName: lib.npmName,
            version: m[1],
            chunkUrl: url,
            detection: 'filecontent',
          };
          break;
        }
      }
    }

    // Filename next.
    if (!best && !URL_MATCH_NOT_TRUSTED.has(lib.name)) {
      for (const re of lib.filename) {
        const m = file.match(re);
        if (m && m[1]) {
          best = {
            library: lib.name,
            npmName: lib.npmName,
            version: m[1],
            chunkUrl: url,
            detection: 'filename',
          };
          break;
        }
      }
    }

    // URI last — easy to spoof or coincidentally match.
    if (!best && !URL_MATCH_NOT_TRUSTED.has(lib.name)) {
      for (const re of lib.uri) {
        const m = url.match(re);
        if (m && m[1]) {
          best = {
            library: lib.name,
            npmName: lib.npmName,
            version: m[1],
            chunkUrl: url,
            detection: 'uri',
          };
          break;
        }
      }
    }

    // FP guard #2: skip if we matched a library but couldn't capture a version.
    // OSV cannot answer "is library X vulnerable" without a version — and
    // emitting a versionless finding is worse than no finding.
    if (best && best.version) {
      perLibrary.set(lib.name, best);
    }
  }

  // FP guard #4: drop children whose parent matched the same chunk.
  for (const [child, parent] of Object.entries(CHILD_OF)) {
    if (perLibrary.has(child) && perLibrary.has(parent)) {
      perLibrary.delete(child);
    }
  }

  return Array.from(perLibrary.values());
}

/**
 * Run every signature against one chunk and return all matches.
 * One library may match via multiple extractors; we de-dupe by
 * (library, version) and prefer the most specific detection method.
 */
export async function detectComponents(chunk: Chunk): Promise<DetectedComponent[]> {
  const compiled = await getCompiled();
  return detectComponentsInner(chunk, compiled);
}

/**
 * Convenience: run detection across many chunks. Loads compiled tables
 * once and reuses them across every chunk.
 */
export async function detectAcrossChunks(chunks: Chunk[]): Promise<DetectedComponent[]> {
  if (chunks.length === 0) return [];
  const compiled = await getCompiled();
  const out: DetectedComponent[] = [];
  for (const chunk of chunks) {
    out.push(...detectComponentsInner(chunk, compiled));
  }
  return out;
}
