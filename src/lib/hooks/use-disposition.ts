'use client';

import { useState, useCallback } from 'react';
import type { FindingDispositionValue } from '@/types';

interface UseDispositionResult {
  current: FindingDispositionValue | null;
  isPending: boolean;
  error: string | null;
  set: (next: FindingDispositionValue) => Promise<void>;
}

/**
 * Phase 3.7 — manages the current user's disposition on a single finding.
 *
 * Optimistic: flips `current` immediately, reverts on POST failure.
 * The server is append-only; this hook only surfaces the latest verdict.
 */
export function useDisposition(
  scanId: string | undefined,
  findingId: string,
  initial: FindingDispositionValue | null,
): UseDispositionResult {
  const [current, setCurrent] = useState<FindingDispositionValue | null>(initial);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = useCallback(
    async (next: FindingDispositionValue) => {
      if (!scanId) {
        setError('Cannot record disposition for an unknown scan.');
        return;
      }
      const previous = current;
      setCurrent(next);
      setIsPending(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/v1/scans/${scanId}/findings/${findingId}/disposition`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ disposition: next }),
          },
        );
        if (!res.ok) {
          setCurrent(previous);
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `Request failed (${res.status})`);
        }
      } catch (err) {
        setCurrent(previous);
        setError(err instanceof Error ? err.message : 'Network error');
      } finally {
        setIsPending(false);
      }
    },
    [scanId, findingId, current],
  );

  return { current, isPending, error, set };
}
