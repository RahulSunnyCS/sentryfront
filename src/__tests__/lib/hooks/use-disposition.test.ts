/**
 * Tests for src/lib/hooks/use-disposition.ts
 *
 * useDisposition() is a React hook (marked 'use client'). We test it with
 * renderHook from @testing-library/react.
 *
 * Covers:
 *   - Initial state
 *   - Optimistic update on success (current changes, isPending clears)
 *   - Rollback on HTTP error (current reverts, error message set)
 *   - Rollback on network error (fetch throws)
 *   - Missing scanId → error, no fetch
 *   - Error body JSON parse failure fallback message
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDisposition } from '@/lib/hooks/use-disposition';
import type { FindingDispositionValue } from '@/types';

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makeOkResponse(status = 200) {
  return {
    ok: true,
    status,
    json: async () => ({}),
  } as unknown as Response;
}

function makeErrorResponse(status: number, body: Record<string, unknown> = {}) {
  return {
    ok: false,
    status,
    json: async () => body,
  } as unknown as Response;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------
describe('useDisposition — initial state', () => {
  it('exposes initial values correctly', () => {
    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', 'CONFIRMED' as FindingDispositionValue),
    );
    expect(result.current.current).toBe('CONFIRMED');
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.set).toBe('function');
  });

  it('initialises current to null when initial is null', () => {
    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', null),
    );
    expect(result.current.current).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Happy path — successful disposition POST
// ---------------------------------------------------------------------------
describe('useDisposition — successful update', () => {
  it('optimistically updates current and clears isPending on success', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeOkResponse());

    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', null),
    );

    await act(async () => {
      await result.current.set('CONFIRMED' as FindingDispositionValue);
    });

    expect(result.current.current).toBe('CONFIRMED');
    expect(result.current.isPending).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('POSTs to the correct API endpoint', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(makeOkResponse());

    const { result } = renderHook(() =>
      useDisposition('scan-42', 'finding-xyz', null),
    );

    await act(async () => {
      await result.current.set('FALSE_POSITIVE' as FindingDispositionValue);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/v1/scans/scan-42/findings/finding-xyz/disposition',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition: 'FALSE_POSITIVE' }),
      }),
    );
  });

  it('isPending is true during the request and false after', async () => {
    let resolveFetch!: (v: Response) => void;
    const fetchPromise = new Promise<Response>((r) => { resolveFetch = r; });
    (global.fetch as ReturnType<typeof vi.fn>).mockReturnValueOnce(fetchPromise);

    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', null),
    );

    // Start the set call but don't await it yet
    let setPromise: Promise<void>;
    act(() => {
      setPromise = result.current.set('CONFIRMED' as FindingDispositionValue);
    });

    // isPending should be true while the request is in flight
    expect(result.current.isPending).toBe(true);

    // Resolve the fetch
    await act(async () => {
      resolveFetch(makeOkResponse());
      await setPromise;
    });

    expect(result.current.isPending).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Error path — HTTP error response
// ---------------------------------------------------------------------------
describe('useDisposition — HTTP error rollback', () => {
  it('reverts current to previous value on non-OK response', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeErrorResponse(500, { error: 'Internal Server Error' }),
    );

    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', 'CONFIRMED' as FindingDispositionValue),
    );

    await act(async () => {
      await result.current.set('FALSE_POSITIVE' as FindingDispositionValue);
    });

    // Should revert to previous value
    expect(result.current.current).toBe('CONFIRMED');
    expect(result.current.error).toBe('Internal Server Error');
    expect(result.current.isPending).toBe(false);
  });

  it('sets a default error message when server returns no error field', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      makeErrorResponse(403, {}),
    );

    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', null),
    );

    await act(async () => {
      await result.current.set('CONFIRMED' as FindingDispositionValue);
    });

    expect(result.current.error).toBe('Request failed (403)');
  });

  it('handles response.json() failure gracefully with fallback message', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => { throw new Error('invalid json'); },
    } as unknown as Response);

    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', null),
    );

    await act(async () => {
      await result.current.set('CONFIRMED' as FindingDispositionValue);
    });

    // json() failure → catch(() => ({})) → no error field → fallback message
    expect(result.current.error).toBe('Request failed (502)');
  });
});

// ---------------------------------------------------------------------------
// Error path — network error (fetch throws)
// ---------------------------------------------------------------------------
describe('useDisposition — network error rollback', () => {
  it('reverts current and sets error message on fetch throw', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Failed to fetch'),
    );

    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', 'CONFIRMED' as FindingDispositionValue),
    );

    await act(async () => {
      await result.current.set('FALSE_POSITIVE' as FindingDispositionValue);
    });

    expect(result.current.current).toBe('CONFIRMED');
    expect(result.current.error).toBe('Failed to fetch');
    expect(result.current.isPending).toBe(false);
  });

  it('sets "Network error" when throw value is not an Error instance', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce('string error');

    const { result } = renderHook(() =>
      useDisposition('scan-1', 'finding-abc', null),
    );

    await act(async () => {
      await result.current.set('CONFIRMED' as FindingDispositionValue);
    });

    expect(result.current.error).toBe('Network error');
  });
});

// ---------------------------------------------------------------------------
// Missing scanId
// ---------------------------------------------------------------------------
describe('useDisposition — missing scanId', () => {
  it('sets an error and does not call fetch when scanId is undefined', async () => {
    const { result } = renderHook(() =>
      useDisposition(undefined, 'finding-abc', null),
    );

    await act(async () => {
      await result.current.set('CONFIRMED' as FindingDispositionValue);
    });

    expect(result.current.error).toBe('Cannot record disposition for an unknown scan.');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(result.current.isPending).toBe(false);
  });

  it('does not change current when scanId is undefined', async () => {
    const { result } = renderHook(() =>
      useDisposition(undefined, 'finding-abc', 'CONFIRMED' as FindingDispositionValue),
    );

    await act(async () => {
      await result.current.set('FALSE_POSITIVE' as FindingDispositionValue);
    });

    // current should NOT have been set to the new value
    expect(result.current.current).toBe('CONFIRMED');
  });
});
