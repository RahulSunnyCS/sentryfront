'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';

type ToastType = 'error' | 'success' | 'info' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  error: (msg: string) => void;
  success: (msg: string) => void;
  info: (msg: string) => void;
  warning: (msg: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const COLORS: Record<ToastType, { bg: string; border: string; accent: string }> = {
  error:   { bg: 'rgba(220,38,38,0.10)',  border: 'rgba(220,38,38,0.30)',  accent: '#DC2626' },
  success: { bg: 'rgba(5,150,105,0.10)',  border: 'rgba(5,150,105,0.30)',  accent: '#059669' },
  warning: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.30)', accent: '#F59E0B' },
  info:    { bg: 'rgba(13,148,136,0.10)', border: 'rgba(13,148,136,0.30)', accent: '#0D9488' },
};

const ICONS: Record<ToastType, string> = {
  error: '✕', success: '✓', warning: '⚠', info: 'ℹ',
};

const DURATION: Record<ToastType, number> = {
  error: 6000, success: 4000, warning: 5000, info: 4000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current;
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, DURATION[type]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    error:   (msg) => push('error', msg),
    success: (msg) => push('success', msg),
    info:    (msg) => push('info', msg),
    warning: (msg) => push('warning', msg),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed',
          bottom: 'var(--space-6)',
          right: 'var(--space-6)',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
          maxWidth: 380,
          width: 'calc(100vw - 48px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((t) => {
          const c = COLORS[t.type];
          return (
            <div
              key={t.id}
              data-testid="toast"
              role="alert"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--space-3)',
                padding: 'var(--space-3) var(--space-4)',
                background: 'var(--surface)',
                border: `1px solid ${c.border}`,
                borderLeft: `3px solid ${c.accent}`,
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                fontSize: 'var(--fs-sm)',
                color: 'var(--text)',
                pointerEvents: 'all',
                animation: 'toastIn 0.2s ease-out both',
              }}
            >
              <span
                style={{
                  color: c.accent,
                  fontWeight: 700,
                  flexShrink: 0,
                  lineHeight: 1.5,
                  fontSize: 13,
                }}
              >
                {ICONS[t.type]}
              </span>
              <span style={{ flex: 1, lineHeight: 1.5 }}>{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  fontSize: 16,
                  lineHeight: 1,
                  padding: 0,
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
