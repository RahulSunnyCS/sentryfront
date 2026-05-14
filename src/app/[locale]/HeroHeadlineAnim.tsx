'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  initial: string;
  final: string;
  line2: string;
  initialVariant: 'alpha' | 'beta' | 'gamma';
}

type Variant = 'alpha' | 'beta' | 'gamma';
const COOKIE_KEY = 'sentry:lastHeroAnim';

// Split initial/final into shared prefix + diverging swap word + shared suffix.
// Word-aware diff: a character-level diff would over-match shared letters
// (e.g. "no" inside "not" and "now") and leave only single letters as the
// swap — that's invisible. Splitting on whitespace yields the whole word.
// Works for en/de/es/hi/ml (all space-separated scripts in this project).
function diffWord(initial: string, final: string) {
  const iTokens = initial.split(/(\s+)/);
  const fTokens = final.split(/(\s+)/);
  let start = 0;
  while (start < iTokens.length && start < fTokens.length && iTokens[start] === fTokens[start]) {
    start++;
  }
  let endI = iTokens.length;
  let endF = fTokens.length;
  while (endI > start && endF > start && iTokens[endI - 1] === fTokens[endF - 1]) {
    endI--;
    endF--;
  }
  return {
    prefix: iTokens.slice(0, start).join(''),
    suffix: iTokens.slice(endI).join(''),
    before: iTokens.slice(start, endI).join(''),
    after: fTokens.slice(start, endF).join(''),
  };
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=${value}; path=/; max-age=${60 * 60 * 24 * 90}; SameSite=Lax`;
}

export function HeroHeadlineAnim({ initial, final, line2, initialVariant }: Props) {
  const variant = initialVariant;
  const [phase, setPhase] = useState<'before' | 'fixed'>('before');
  const swapRef = useRef<HTMLSpanElement | null>(null);

  // Persist the server-picked variant so the *next* visit rotates.
  useEffect(() => {
    writeCookie(COOKIE_KEY, variant);
    try { localStorage.setItem(COOKIE_KEY, variant); } catch {}
  }, [variant]);

  // Kick off the animation after mount.
  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setPhase('fixed');
      return;
    }
    const delays: Record<Variant, number> = { alpha: 2400, beta: 2000, gamma: 1500 };
    const t = window.setTimeout(() => setPhase('fixed'), delays[variant]);
    return () => window.clearTimeout(t);
  }, [variant]);

  const diff = diffWord(initial, final);

  return (
    <div
      data-hero-anim={variant}
      style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}
    >
      <h1
        id="hero-heading"
        className="text-hero hero-anim-h1"
        data-phase={phase}
        style={{ marginBottom: 'var(--space-4)', position: 'relative' }}
      >
        <span>{diff.prefix}</span>
        <span ref={swapRef} className="hero-swap" data-phase={phase}>
          <span className="hero-swap-before">{diff.before}</span>
          <span className="hero-swap-after">{diff.after}</span>
        </span>
        <span>{diff.suffix}</span>
        <br />
        {line2}
      </h1>

      {variant === 'alpha' && <HeroAnimAlpha phase={phase} swapRef={swapRef} />}
      {variant === 'beta' && <HeroAnimBeta phase={phase} swapRef={swapRef} />}
      {variant === 'gamma' && <HeroAnimGamma phase={phase} swapRef={swapRef} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// α — Hacker walks in, swaps the letter
// ─────────────────────────────────────────────────────────────
function HeroAnimAlpha({
  phase,
  swapRef,
}: {
  phase: 'before' | 'fixed';
  swapRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const [targetX, setTargetX] = useState<number | null>(null);
  const [hostRect, setHostRect] = useState<{ left: number; bottom: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = swapRef.current;
      const host = el?.closest('.hero-anim-h1')?.parentElement;
      if (!el || !host) return;
      const r = el.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      setTargetX(r.left + r.width / 2 - h.left);
      setHostRect({ left: h.left, bottom: h.bottom });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [swapRef]);

  if (targetX == null || !hostRect) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    >
      <div
        className="hero-hacker"
        data-phase={phase}
        style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          width: 48,
          height: 64,
          transform: 'translate3d(-80px, -50%, 0)',
          // @ts-expect-error custom property
          '--hacker-target-x': `${targetX - 24}px`,
        }}
      >
        <HackerMiniSvg />
      </div>
    </div>
  );
}

function HackerMiniSvg() {
  return (
    <svg viewBox="0 0 48 64" width="48" height="64" aria-hidden="true">
      <defs>
        <linearGradient id="hood-mini" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#1f2937" />
          <stop offset="100%" stopColor="#0b1220" />
        </linearGradient>
      </defs>
      <ellipse cx="24" cy="62" rx="18" ry="2" fill="rgba(0,0,0,0.35)" />
      <path
        d="M 8 20 Q 10 4 24 3 Q 38 4 40 20 L 42 38 Q 38 44 24 44 Q 10 44 6 38 Z"
        fill="url(#hood-mini)"
        stroke="rgba(94,234,212,0.5)"
        strokeWidth="1"
      />
      <ellipse cx="24" cy="22" rx="11" ry="8" fill="#000" opacity="0.85" />
      <circle cx="20" cy="21" r="1.5" fill="#5EEAD4">
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx="28" cy="21" r="1.5" fill="#5EEAD4">
        <animate attributeName="opacity" values="1;0.4;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <rect x="10" y="42" width="28" height="14" rx="3" fill="#1f2937" />
      <rect x="14" y="46" width="20" height="8" rx="2" fill="#5EEAD4" opacity="0.85" />
      <rect x="20" y="56" width="8" height="6" fill="#1f2937" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// β — Terminal injection
// ─────────────────────────────────────────────────────────────
function HeroAnimBeta({
  phase,
  swapRef,
}: {
  phase: 'before' | 'fixed';
  swapRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const beforeWord = swapRef.current?.querySelector('.hero-swap-before')?.textContent ?? 'not';
  const afterWord = swapRef.current?.querySelector('.hero-swap-after')?.textContent ?? 'now';
  const cmd = `$ sed -i 's/${beforeWord}/${afterWord}/' headline.tsx`;
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= cmd.length) window.clearInterval(id);
    }, 32);
    return () => window.clearInterval(id);
  }, [cmd.length]);

  return (
    <div
      aria-hidden="true"
      data-phase={phase}
      className="hero-term"
      style={{
        position: 'absolute',
        left: '50%',
        bottom: -80,
        transform: 'translateX(-50%)',
        width: 'min(360px, 90vw)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          background: 'rgba(8, 14, 10, 0.92)',
          border: '1px solid rgba(94,234,212,0.45)',
          borderRadius: 8,
          padding: '8px 12px 10px',
          fontFamily: 'var(--mono)',
          fontSize: 12,
          color: '#86efac',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45), 0 0 24px rgba(94,234,212,0.18)',
          textAlign: 'left',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 6,
            paddingBottom: 4,
            borderBottom: '1px solid rgba(94,234,212,0.15)',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f56', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffbd2e', display: 'inline-block' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#27c93f', display: 'inline-block' }} />
          <span style={{ flex: 1, textAlign: 'center', color: '#86efac', opacity: 0.7, fontSize: 10 }}>
            patcher.sh
          </span>
        </div>
        <div style={{ minHeight: 28, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          <span style={{ color: '#5EEAD4' }}>{cmd.slice(0, revealed)}</span>
          {phase === 'before' && revealed < cmd.length && (
            <span className="terminal-caret" style={{ color: '#5EEAD4' }}>▍</span>
          )}
          {phase === 'fixed' && (
            <div style={{ color: '#4ade80', marginTop: 4 }}>✓ patched</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// γ — Code-rain wash
// ─────────────────────────────────────────────────────────────
function HeroAnimGamma({
  phase,
  swapRef,
}: {
  phase: 'before' | 'fixed';
  swapRef: React.RefObject<HTMLSpanElement | null>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  useEffect(() => {
    const measure = () => {
      const el = swapRef.current;
      const host = el?.closest('.hero-anim-h1')?.parentElement;
      if (!el || !host) return;
      const r = el.getBoundingClientRect();
      const h = host.getBoundingClientRect();
      setRect({
        left: r.left - h.left,
        top: r.top - h.top,
        width: r.width,
        height: r.height,
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [swapRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rect || phase === 'fixed') return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = Math.max(40, Math.floor(rect.width));
    canvas.height = Math.max(40, Math.floor(rect.height + 20));
    const fontSize = 12;
    const cols = Math.floor(canvas.width / fontSize);
    const drops = new Array(cols).fill(0).map(() => Math.random() * -8);
    const chars = '01ABCDEF{};<>$/\\#*';
    let raf = 0;
    const tick = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = `${fontSize}px ui-monospace, Menlo, monospace`;
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;
        ctx.fillStyle = y < fontSize * 2 ? '#bbf7d0' : '#22c55e';
        ctx.fillText(ch, x, y);
        if (y > canvas.height && Math.random() > 0.9) drops[i] = 0;
        drops[i] += 0.8;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [rect, phase]);

  if (!rect) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="hero-rain-canvas"
      data-phase={phase}
      style={{
        position: 'absolute',
        left: rect.left,
        top: rect.top - 4,
        width: rect.width,
        height: rect.height + 20,
        pointerEvents: 'none',
        mixBlendMode: 'screen',
      }}
    />
  );
}

