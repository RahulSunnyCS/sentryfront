// API routes live at the same origin — no base URL configuration needed.
// "Demo mode" now means the scan ID is "demo" and fixture data is shown,
// not that the API is absent.

export const defaultAccent = (
  process.env.NEXT_PUBLIC_DEFAULT_ACCENT?.trim() || 'teal'
) as 'teal' | 'indigo' | 'violet';

// True when running with SQLite (local dev). Shows a subtle DB-mode indicator.
export const isSqliteMode =
  (process.env.DATABASE_URL ?? 'file:').startsWith('file:') ||
  (process.env.DATABASE_URL ?? 'file:').startsWith('sqlite:');
