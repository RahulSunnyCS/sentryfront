import type { RawFinding } from '../types';
import type { ApkContents } from '../apk-analyzer';
import { parseAxmlStrings } from '../apk-analyzer';

// Permissions considered dangerous (require runtime grant on API 23+)
// Map: permission name → human-readable risk
const DANGEROUS_PERMISSIONS: Record<string, { risk: string; severity: 'HIGH' | 'MEDIUM' }> = {
  'android.permission.READ_CONTACTS':          { risk: 'access to all contacts', severity: 'HIGH' },
  'android.permission.WRITE_CONTACTS':         { risk: 'write/delete contacts', severity: 'HIGH' },
  'android.permission.READ_CALL_LOG':          { risk: 'access to call history', severity: 'HIGH' },
  'android.permission.WRITE_CALL_LOG':         { risk: 'modify call log', severity: 'HIGH' },
  'android.permission.READ_SMS':               { risk: 'read all SMS messages', severity: 'HIGH' },
  'android.permission.RECEIVE_SMS':            { risk: 'intercept incoming SMS (used for MFA bypass)', severity: 'HIGH' },
  'android.permission.SEND_SMS':               { risk: 'send SMS (potential premium-rate fraud)', severity: 'HIGH' },
  'android.permission.PROCESS_OUTGOING_CALLS': { risk: 'intercept/redirect phone calls', severity: 'HIGH' },
  'android.permission.RECORD_AUDIO':           { risk: 'microphone access', severity: 'HIGH' },
  'android.permission.CAMERA':                 { risk: 'camera access', severity: 'MEDIUM' },
  'android.permission.ACCESS_FINE_LOCATION':   { risk: 'precise GPS location', severity: 'MEDIUM' },
  'android.permission.ACCESS_BACKGROUND_LOCATION': { risk: 'location tracking while app is in background', severity: 'HIGH' },
  'android.permission.READ_EXTERNAL_STORAGE':  { risk: 'access all files on device', severity: 'MEDIUM' },
  'android.permission.WRITE_EXTERNAL_STORAGE': { risk: 'write to all files on device', severity: 'MEDIUM' },
  'android.permission.GET_ACCOUNTS':           { risk: 'enumerate all accounts on device', severity: 'MEDIUM' },
  'android.permission.USE_BIOMETRIC':          { risk: 'biometric authentication', severity: 'MEDIUM' },
  'android.permission.MANAGE_EXTERNAL_STORAGE':{ risk: 'full access to all device storage', severity: 'HIGH' },
  'android.permission.SYSTEM_ALERT_WINDOW':    { risk: 'draw overlays over other apps (clickjacking risk)', severity: 'HIGH' },
  'android.permission.BIND_ACCESSIBILITY_SERVICE': { risk: 'full accessibility service (used in banking malware)', severity: 'HIGH' },
  'android.permission.INSTALL_PACKAGES':       { risk: 'install arbitrary APKs', severity: 'HIGH' },
  'android.permission.REQUEST_INSTALL_PACKAGES': { risk: 'request to install unknown APKs', severity: 'MEDIUM' },
};

export function runPermissionsModule(apk: ApkContents): RawFinding[] {
  const findings: RawFinding[] = [];
  const buf = apk.manifestBytes;
  if (!buf) return findings;

  const strings = parseAxmlStrings(buf);
  if (strings.length === 0) return findings;

  // Collect all permission strings declared in the manifest
  const declaredPermissions = strings.filter((s) =>
    s.startsWith('android.permission.') || s.startsWith('com.') && s.includes('.permission.')
  );

  const dangerousFound: Array<{ perm: string; risk: string; severity: 'HIGH' | 'MEDIUM' }> = [];
  for (const perm of declaredPermissions) {
    const info = DANGEROUS_PERMISSIONS[perm];
    if (info) {
      dangerousFound.push({ perm, ...info });
    }
  }

  if (dangerousFound.length === 0) return findings;

  // Group by severity
  const high = dangerousFound.filter((p) => p.severity === 'HIGH');
  const medium = dangerousFound.filter((p) => p.severity === 'MEDIUM');

  if (high.length > 0) {
    const permList = high.map((p) => `• ${p.perm.replace('android.permission.', '')} — ${p.risk}`).join('\n');
    findings.push({
      moduleId: 'M1-04',
      severity: 'HIGH',
      category: 'Permission Hygiene',
      title: `${high.length} high-risk permission(s) declared`,
      location: 'AndroidManifest.xml › <uses-permission>',
      evidence: permList,
      explanation: 'The app requests high-risk permissions that grant access to sensitive user data (SMS, contacts, location, microphone). These permissions must be justified by the app\'s core function. Excessive permissions increase the blast radius of a security incident and may violate app store policies.',
      impact: 'If the app is compromised (via a supply-chain attack or a vulnerability), the attacker gains access to all permitted sensitive data. Users may also reject installation due to excessive permission requests.',
      fixManual: [
        'Review each permission and remove any that are not strictly required for core functionality.',
        'Request permissions at the point of use (runtime permissions) rather than at startup.',
        'Provide clear in-app justification before requesting sensitive permissions.',
        'For SMS/Contacts/Call-log access: be prepared to justify this to app store reviewers.',
      ],
      fixAiPrompt: `My Android app declares high-risk permissions: ${high.map((p) => p.perm).join(', ')}. Review the AndroidManifest.xml, remove unnecessary permissions, and implement runtime permission requests with in-app rationale for the ones you keep.`,
      confidence: 'medium',
    });
  }

  if (medium.length > 0) {
    const permList = medium.map((p) => `• ${p.perm.replace('android.permission.', '')} — ${p.risk}`).join('\n');
    findings.push({
      moduleId: 'M1-04',
      severity: 'MEDIUM',
      category: 'Permission Hygiene',
      title: `${medium.length} sensitive permission(s) declared`,
      location: 'AndroidManifest.xml › <uses-permission>',
      evidence: permList,
      explanation: 'The app requests permissions that access sensitive device capabilities (camera, location, storage). While these may be justified by the app\'s function, they should be reviewed and minimised.',
      impact: 'Excessive permissions increase user privacy risk and can lead to app store rejection or user distrust.',
      fixManual: [
        'Remove any permission not strictly required for core functionality.',
        'Use scoped storage (Android 10+) instead of broad external storage permissions.',
        'For location: prefer ACCESS_COARSE_LOCATION over ACCESS_FINE_LOCATION when precise location is not needed.',
      ],
      fixAiPrompt: `My Android app declares permissions: ${medium.map((p) => p.perm).join(', ')}. Review if each is necessary and replace broad permissions with narrower scoped alternatives where possible.`,
      confidence: 'medium',
    });
  }

  return findings;
}
