/**
 * Report-access scoping.
 *
 * Rule: a scan is viewable when either
 *   - the scan has no owner (userId === null) — created by an anonymous
 *     visitor via the public "paste a URL" flow; sharing by ID is the
 *     point, and
 *   - OR the requesting user owns it (scan.userId === user.id).
 *
 * Everything else is 404 (not 403) so we don't leak existence of scans
 * the caller isn't entitled to see.
 */

import type { AuthUser } from './auth/helpers';

export function canViewScan(
  scan: { userId: string | null },
  user: AuthUser | null,
): boolean {
  if (scan.userId === null) return true;
  return user !== null && user.id === scan.userId;
}
