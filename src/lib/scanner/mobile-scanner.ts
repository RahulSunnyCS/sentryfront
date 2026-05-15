import { extractApk } from './apk-analyzer';
import { runMobileSecretsModule } from './modules/m1-01-hardcoded-secrets';
import { runAndroidManifestModule } from './modules/m1-02-android-manifest';
import { runCleartextTrafficModule } from './modules/m1-03-cleartext-traffic';
import { runPermissionsModule } from './modules/m1-04-permissions';
import { readFileSync, existsSync } from 'fs';
import type { RawFinding } from './types';

export interface MobileScannerResult {
  findings: RawFinding[];
  platform: 'apk' | 'ipa';
  appName: string;
  moduleFindingCounts: Record<string, number>;
}

export const MOBILE_ALL_MODULES = ['M1-01', 'M1-02', 'M1-03', 'M1-04'] as const;

export async function runMobileScanner(
  filePath: string,
  platform: 'apk' | 'ipa',
): Promise<MobileScannerResult> {
  if (platform === 'ipa') {
    return runIpaScanner(filePath);
  }
  return runApkScanner(filePath);
}

async function runApkScanner(apkPath: string): Promise<MobileScannerResult> {
  if (!existsSync(apkPath)) {
    throw new Error(`APK file not found: ${apkPath}`);
  }

  const buffer = readFileSync(apkPath);
  const apk = extractApk(buffer);

  try {
    const [secretsFindings, manifestFindings, cleartextFindings, permissionsFindings] =
      await Promise.all([
        Promise.resolve(runMobileSecretsModule(apk)),
        Promise.resolve(runAndroidManifestModule(apk)),
        Promise.resolve(runCleartextTrafficModule(apk)),
        Promise.resolve(runPermissionsModule(apk)),
      ]);

    const allModuleFindings: Array<{ id: string; findings: RawFinding[] }> = [
      { id: 'M1-01', findings: secretsFindings },
      { id: 'M1-02', findings: manifestFindings },
      { id: 'M1-03', findings: cleartextFindings },
      { id: 'M1-04', findings: permissionsFindings },
    ];

    const findings = allModuleFindings.flatMap((m) => m.findings);
    const moduleFindingCounts = Object.fromEntries(
      allModuleFindings.map((m) => [m.id, m.findings.length]),
    );

    // Derive app name from package name in string pool or fall back to filename
    const appName = deriveAppName(apkPath, apk.manifestBytes);

    return { findings, platform: 'apk', appName, moduleFindingCounts };
  } finally {
    apk.cleanup();
  }
}

async function runIpaScanner(ipaPath: string): Promise<MobileScannerResult> {
  // IPA support: extract and scan text files for secrets (same as APK)
  // Manifest analysis is deferred to a future iOS-specific module.
  if (!existsSync(ipaPath)) {
    throw new Error(`IPA file not found: ${ipaPath}`);
  }

  const buffer = readFileSync(ipaPath);
  const apk = extractApk(buffer); // IPA is also a ZIP; reuse extractor

  try {
    const secretsFindings = runMobileSecretsModule(apk);

    const findings = secretsFindings;
    const moduleFindingCounts = {
      'M1-01': secretsFindings.length,
      'M1-02': 0,
      'M1-03': 0,
      'M1-04': 0,
    };

    const appName = ipaPath.split('/').pop()?.replace(/\.ipa$/i, '') ?? 'iOS App';

    return { findings, platform: 'ipa', appName, moduleFindingCounts };
  } finally {
    apk.cleanup();
  }
}

function deriveAppName(filePath: string, manifestBytes: Buffer | null): string {
  const fallback = filePath.split('/').pop()?.replace(/\.apk$/i, '') ?? 'Android App';
  if (!manifestBytes) return fallback;

  // Import parseAxmlStrings lazily to avoid circular dependency issues
  try {
    const { parseAxmlStrings } = require('./apk-analyzer') as typeof import('./apk-analyzer');
    const strings = parseAxmlStrings(manifestBytes);
    // Package name is typically the first dotted-path string (e.g., com.example.app)
    const pkg = strings.find(
      (s) => s.includes('.') && /^[a-z][a-z0-9_.]+$/.test(s) && s.split('.').length >= 2,
    );
    return pkg ?? fallback;
  } catch {
    return fallback;
  }
}
