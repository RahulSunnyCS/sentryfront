'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SCAN_MODULES, SEVERITY_CONFIG } from '@/lib/data';
import { openScanStream } from '@/lib/api';
import { IconGlobe, IconCheckCircle, IconAlertCircle, IconSpinner } from '@/components/icons';

interface Props {
  scanId: string;
  scanUrl: string;
}

const MOCK_INTERVAL_MS = 340;

export function ScanProgress({ scanId, scanUrl }: Props) {
  const router = useRouter();
  const [completedModules, setCompletedModules] = useState(0);
  const [activeModule, setActiveModule] = useState(0);
  const [moduleResults, setModuleResults] = useState<Record<string, number>>({});
  const streamRef = useRef<EventSource | null>(null);

  const total = SCAN_MODULES.length;
  const progress = Math.round((completedModules / total) * 100);

  useEffect(() => {
    const stream = openScanStream(scanId);

    if (stream) {
      // Real SSE mode
      streamRef.current = stream;

      stream.addEventListener('module_complete', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as { module_id: string; findings: number; index: number };
        setModuleResults((prev) => ({ ...prev, [data.module_id]: data.findings }));
        setCompletedModules(data.index + 1);
        setActiveModule(data.index + 1);
      });

      stream.addEventListener('scan_complete', () => {
        stream.close();
        setTimeout(() => router.push(`/report/${scanId}`), 1200);
      });

      stream.addEventListener('scan_failed', () => {
        stream.close();
        router.push(`/?error=scan_failed`);
      });

      return () => stream.close();
    }

    // Mock mode — simulate module-by-module progress with fixture results
    const BAD_RESULTS: Record<string, number> = {
      'P1-01': 1, 'P1-02': 1, 'P1-03': 2, 'P1-04': 0,
      'P1-05': 1, 'P1-06': 1, 'P1-07': 1, 'P1-08': 1,
      'P1-09': 1, 'P1-10': 0, 'P1-11': 0, 'P1-12': 0,
      'P1-13': 1, 'P1-14': 1, 'P1-15': 0,
    };

    let idx = 0;
    const interval = setInterval(() => {
      idx++;
      const mod = SCAN_MODULES[idx - 1];
      if (mod) {
        setModuleResults((prev) => ({ ...prev, [mod.id]: BAD_RESULTS[mod.id] ?? 0 }));
      }
      setActiveModule(idx);
      setCompletedModules(idx);
      if (idx >= total) {
        clearInterval(interval);
        setTimeout(() => router.push(`/report/${scanId}?url=${encodeURIComponent(scanUrl)}`), 1200);
      }
    }, MOCK_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [scanId, scanUrl, router, total]);

  return (
    <div style={{
      minHeight: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 24,
    }}>
      <div className="screen-enter" style={{
        width: '100%', maxWidth: 520, backgroundColor: 'var(--surface)',
        borderRadius: 16, border: '1px solid var(--border)', padding: '36px 32px',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
            <IconGlobe size={18} color="var(--accent)" />
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>{scanUrl}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
            {completedModules < total ? 'Scanning in progress…' : 'Analysis complete — preparing report'}
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--border-light)', marginBottom: 28, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3, backgroundColor: 'var(--accent)',
            width: `${progress}%`, transition: 'width 0.3s ease-out',
          }} />
        </div>

        {/* Module list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {SCAN_MODULES.map((mod, i) => {
            const isDone = i < completedModules;
            const isActive = i === activeModule && !isDone && i < total;
            const isPending = !isDone && !isActive;
            const findCount = moduleResults[mod.id] ?? 0;

            return (
              <div key={mod.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px',
                borderRadius: 8, opacity: isPending ? 0.4 : 1,
                backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                transition: 'all 0.3s',
              }}>
                <div style={{ width: 22, display: 'flex', justifyContent: 'center' }}>
                  {isDone ? (
                    findCount > 0
                      ? <IconAlertCircle size={18} color={SEVERITY_CONFIG[findCount >= 2 ? 'MEDIUM' : 'HIGH'].color} />
                      : <IconCheckCircle size={18} color="#059669" />
                  ) : isActive ? (
                    <IconSpinner size={18} />
                  ) : (
                    <div style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: 'var(--border)' }} />
                  )}
                </div>
                <span style={{
                  flex: 1, fontSize: 14, fontWeight: isDone || isActive ? 500 : 400,
                  color: isPending ? 'var(--text-tertiary)' : 'var(--text)',
                }}>{mod.name}</span>
                {isDone && findCount > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                    padding: '1px 8px', borderRadius: 10, backgroundColor: 'var(--accent-light)',
                  }}>
                    {findCount} found
                  </span>
                )}
                {isDone && findCount === 0 && (
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>Clear</span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 13, color: 'var(--text-tertiary)' }}>
          {completedModules}/{total} checks completed
        </div>
      </div>
    </div>
  );
}
