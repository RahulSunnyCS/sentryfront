// Reads env at runtime (client-side NEXT_PUBLIC_* vars are inlined at build time).
// Returns null when the variable is absent or blank — callers treat null as "mock mode".

export const apiUrl: string | null =
  process.env.NEXT_PUBLIC_API_URL?.trim() || null;

export const defaultAccent = (process.env.NEXT_PUBLIC_DEFAULT_ACCENT?.trim() || 'teal') as
  'teal' | 'indigo' | 'violet';

export const isMockMode = apiUrl === null;
