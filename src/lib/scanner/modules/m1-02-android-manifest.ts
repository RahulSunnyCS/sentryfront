import type { RawFinding } from '../types';
import type { ApkContents } from '../apk-analyzer';
import { parseAxmlStrings, isAxmlAttrTrue, ANDROID_ATTR } from '../apk-analyzer';

export function runAndroidManifestModule(apk: ApkContents): RawFinding[] {
  const findings: RawFinding[] = [];
  const buf = apk.manifestBytes;
  if (!buf) return findings;

  // ── Debuggable ──────────────────────────────────────────────────────────────
  if (isAxmlAttrTrue(buf, ANDROID_ATTR.debuggable)) {
    findings.push({
      moduleId: 'M1-02',
      severity: 'CRITICAL',
      category: 'Application Configuration',
      title: 'App is debuggable in production build',
      location: 'AndroidManifest.xml › <application android:debuggable="true">',
      evidence: 'android:debuggable="true" detected in AndroidManifest.xml',
      explanation: 'The app was built with debugging enabled. This allows any attacker with USB access (or a rooted device) to attach a debugger, inspect memory, bypass certificate pinning, and extract secrets at runtime.',
      impact: 'An attacker with physical access or a rooted device can fully instrument the app, bypass security controls, and extract all in-memory data including decrypted secrets and session tokens.',
      fixManual: [
        'Set android:debuggable="false" in AndroidManifest.xml.',
        'Better: do not set debuggable at all — release builds default to false.',
        'Ensure your release build process uses a release signing configuration.',
        'Add a CI check to fail the build if debuggable=true is found in a release artifact.',
      ],
      fixAiPrompt: 'My Android APK has android:debuggable="true" in the manifest. Remove this attribute from the AndroidManifest.xml and configure ProGuard/R8 to strip debug symbols in release builds.',
      confidence: 'high',
    });
  }

  // ── Backup enabled ───────────────────────────────────────────────────────────
  if (isAxmlAttrTrue(buf, ANDROID_ATTR.allowBackup)) {
    findings.push({
      moduleId: 'M1-02',
      severity: 'MEDIUM',
      category: 'Application Configuration',
      title: 'App allows unencrypted Android backup',
      location: 'AndroidManifest.xml › <application android:allowBackup="true">',
      evidence: 'android:allowBackup="true" detected in AndroidManifest.xml',
      explanation: 'With allowBackup enabled, app data (including databases, shared preferences, and files) can be extracted via "adb backup" without root access. This exposes user data even on non-rooted devices.',
      impact: 'Sensitive user data — including session tokens, cached credentials, and private files — can be extracted by anyone with USB access to the device.',
      fixManual: [
        'Set android:allowBackup="false" unless you have a specific need for backups.',
        'If backups are required, implement android:fullBackupContent or android:dataExtractionRules to exclude sensitive files.',
        'Encrypt sensitive data before storing it locally.',
      ],
      fixAiPrompt: 'My Android app has android:allowBackup="true". Set allowBackup="false" or configure a fullBackupContent rule that excludes sensitive data like databases and shared preferences containing tokens.',
      confidence: 'high',
    });
  }

  // ── Cleartext traffic (manifest-level) ──────────────────────────────────────
  if (isAxmlAttrTrue(buf, ANDROID_ATTR.usesCleartextTraffic)) {
    findings.push({
      moduleId: 'M1-02',
      severity: 'HIGH',
      category: 'Network Security',
      title: 'Cleartext (HTTP) traffic permitted in manifest',
      location: 'AndroidManifest.xml › <application android:usesCleartextTraffic="true">',
      evidence: 'android:usesCleartextTraffic="true" detected in AndroidManifest.xml',
      explanation: 'The app explicitly permits unencrypted HTTP traffic. All data sent over HTTP is visible to anyone on the same network (coffee shop Wi-Fi, ISP, etc.) and can be intercepted with trivial tools.',
      impact: 'Authentication tokens, API calls, and user data transmitted over HTTP are exposed to network-level attackers. This also enables trivial man-in-the-middle attacks.',
      fixManual: [
        'Set android:usesCleartextTraffic="false" in AndroidManifest.xml.',
        'Migrate all API endpoints to HTTPS.',
        'Use a network_security_config.xml file to explicitly define allowed domains if you need exceptions for specific third-party SDKs.',
      ],
      fixAiPrompt: 'My Android app has usesCleartextTraffic="true". Set it to false and update all HTTP endpoints to HTTPS. Create a network_security_config.xml if certain SDKs require temporary cleartext exceptions.',
      confidence: 'high',
    });
  }

  // ── Package name / extract string pool for context ───────────────────────────
  const strings = parseAxmlStrings(buf);
  const packageName = strings.find((s) => s.includes('.') && /^[a-z][a-z0-9_.]+$/.test(s) && s.split('.').length >= 2) ?? 'com.example.app';

  // ── Exported components without permission ──────────────────────────────────
  // We detect this by counting "exported" true attrs in the manifest.
  // A rough signal: if exported=true appears more than once and no permission
  // attribute appears nearby, flag it.
  let exportedTrueCount = 0;
  const exportedId = ANDROID_ATTR.exported;
  const b0 = exportedId & 0xff;
  const b1 = (exportedId >> 8) & 0xff;
  const b2 = (exportedId >> 16) & 0xff;
  const b3 = (exportedId >> 24) & 0xff;

  for (let i = 4; i <= buf.length - 20; i++) {
    if (buf[i] !== b0 || buf[i + 1] !== b1 || buf[i + 2] !== b2 || buf[i + 3] !== b3) continue;
    if (buf[i + 8] !== 0x08 || buf[i + 9] !== 0x00 || buf[i + 10] !== 0x00) continue;
    if (buf[i + 11] !== 0x12) continue;
    if (buf[i + 12] !== 0 || buf[i + 13] !== 0 || buf[i + 14] !== 0 || buf[i + 15] !== 0) {
      exportedTrueCount++;
    }
  }

  if (exportedTrueCount > 0) {
    findings.push({
      moduleId: 'M1-02',
      severity: 'HIGH',
      category: 'Application Configuration',
      title: `${exportedTrueCount} exported component(s) detected — verify permissions`,
      location: `AndroidManifest.xml › android:exported="true" (${exportedTrueCount} occurrences)`,
      evidence: `android:exported="true" found on ${exportedTrueCount} component(s) in ${packageName}`,
      explanation: 'Exported components (activities, services, broadcast receivers, content providers) are accessible to other apps on the device. Without a permission check, malicious apps can launch them to steal data, trigger actions, or bypass authentication flows.',
      impact: 'Other apps on the device (including malicious ones) can invoke exported components. This can expose user data, trigger privileged operations, or allow intent injection attacks.',
      fixManual: [
        'Review each exported component and confirm it needs to be exported.',
        'Add android:permission="<your.permission>" to restrict which apps can access it.',
        'For activities only called internally, set android:exported="false".',
        'For content providers, restrict access with read/write permissions.',
      ],
      fixAiPrompt: `My Android app has ${exportedTrueCount} exported components in AndroidManifest.xml. Review each one, set exported="false" where not needed, and add permission requirements to the rest.`,
      confidence: 'medium',
    });
  }

  return findings;
}
