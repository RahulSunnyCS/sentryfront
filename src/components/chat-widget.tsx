'use client';

import { useEffect, useRef, useState } from 'react';

interface Message {
  from: 'user' | 'bot';
  text: string;
  id: number;
}

const BOT_NAME = 'Codifie Support';

function getBotReply(text: string): string {
  const t = text.toLowerCase();
  if (/\b(hi|hello|hey|howdy)\b/.test(t))
    return "Hi there! 👋 How can I help you today?";
  if (/\bpric(e|ing|es)\b/.test(t))
    return "We have a free tier (1 scan/week, no card needed). Paid plans unlock active DAST testing and continuous monitoring. Check out the Pricing page for full details!";
  if (/\bscan\b/.test(t))
    return "To start a scan, head to your Dashboard, paste your site URL, and hit Scan. Full results — headers, secrets, CVEs, and more — come back in under a minute.";
  if (/\b(sign.?up|register|creat.* account)\b/.test(t))
    return "Signing up is free and takes about 30 seconds — no credit card required. Click 'Sign up for free' from the login page.";
  if (/\b(sign.?in|log.?in|login)\b/.test(t))
    return "You can sign in with GitHub, Google, or email/password. Hit 'Sign in' in the top nav to get started.";
  if (/\b(security|vulnerabilit|owasp|cve|header)\b/.test(t))
    return "We check OWASP Top 10 vulnerabilities, security headers (CSP, HSTS, X-Frame-Options), exposed secrets, outdated libraries, and more — all in one scan.";
  if (/\b(dashboard|account|profile)\b/.test(t))
    return "Your Dashboard shows all past scans, your security grade over time, and your weekly scan quota. Sign in to access it.";
  if (/\b(bug|issue|problem|broken|error|crash)\b/.test(t))
    return "Sorry you're running into trouble! Could you describe what happened? Our team reviews all reports and usually responds within 24 hours.";
  if (/\b(help|support|contact|talk|human|agent)\b/.test(t))
    return "Happy to help! Ask me anything about features, pricing, or scanning. For complex issues you can also reach us at support@codifie.dev.";
  if (/\b(free|cost|pay|credit card)\b/.test(t))
    return "The free tier gives you one full passive scan per week with no credit card required. Active DAST testing and monitoring are available as paid add-ons.";
  return "Thanks for your message! 🙏 Our team will follow up shortly. Is there anything else I can help clarify in the meantime?";
}

let idCounter = 0;
function nextId() { return ++idCounter; }

const INITIAL_MESSAGES: Message[] = [
  { from: 'bot', text: "Hi! I'm here to help. Ask me anything about scanning, pricing, or your account. 👋", id: nextId() },
];

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  const send = () => {
    const text = input.trim();
    if (!text || typing) return;

    setInput('');
    setMessages((prev) => [...prev, { from: 'user', text, id: nextId() }]);
    setTyping(true);

    setTimeout(() => {
      const reply = getBotReply(text);
      setMessages((prev) => [...prev, { from: 'bot', text: reply, id: nextId() }]);
      setTyping(false);
    }, 700 + Math.random() * 400);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') send();
  };

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, fontFamily: 'inherit' }}>
      {/* Chat panel */}
      <div
        aria-label="Chat support"
        style={{
          position: 'absolute',
          bottom: 64,
          right: 0,
          width: 340,
          maxHeight: open ? 480 : 0,
          overflow: 'hidden',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-md)',
          border: open ? '1px solid var(--border)' : 'none',
          background: 'var(--surface)',
          transition: 'max-height 0.25s ease, opacity 0.2s ease, border 0.1s',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--accent)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{BOT_NAME}</span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Close chat"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#fff', padding: 4, lineHeight: 1 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '8px 12px',
                  borderRadius: msg.from === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.from === 'user' ? 'var(--accent)' : 'var(--surface-raised, var(--border))',
                  color: msg.from === 'user' ? '#fff' : 'var(--text)',
                  fontSize: 13,
                  lineHeight: 1.45,
                  wordBreak: 'break-word',
                }}
              >
                {msg.text}
              </div>
            </div>
          ))}
          {typing && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{ padding: '8px 14px', borderRadius: '16px 16px 16px 4px', background: 'var(--surface-raised, var(--border))', display: 'flex', gap: 4, alignItems: 'center' }}>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--text-secondary)',
                      display: 'inline-block',
                      animation: `chatDot 1.2s ${i * 0.2}s infinite ease-in-out`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Type a message…"
            disabled={typing}
            style={{
              flex: 1,
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md, 8px)',
              padding: '8px 12px',
              fontSize: 13,
              background: 'var(--bg)',
              color: 'var(--text)',
              outline: 'none',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || typing}
            aria-label="Send message"
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 'var(--radius-md, 8px)',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: !input.trim() || typing ? 'not-allowed' : 'pointer',
              opacity: !input.trim() || typing ? 0.5 : 1,
              flexShrink: 0,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" fill="#fff" stroke="none" />
            </svg>
          </button>
        </div>
      </div>

      {/* Typing animation keyframes */}
      <style>{`
        @keyframes chatDot {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* Bubble toggle button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        style={{
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          transition: 'transform 0.2s ease',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>
    </div>
  );
}
