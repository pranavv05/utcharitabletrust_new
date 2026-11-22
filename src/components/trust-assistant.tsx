'use client';
import {useEffect, useRef, useState} from 'react';
import {Bot, Phone, X, Send, RotateCcw} from 'lucide-react';
import Link from 'next/link';
import {whatsappLink} from '@/lib/contact-links';
import type {ChatLink} from '@/lib/trust-chat';
type Message = {role: 'assistant' | 'user'; content: string; links?: ChatLink[]};
const welcome: Message = {
  role: 'assistant',
  content:
    'Hello! I’m the trust’s website assistant. Ask me about our programmes, book bank, membership or ways to help.',
};
export function TrustAssistant() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('guide');
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    const abort = new AbortController();
    fetch('/api/chat', {signal: abort.signal})
      .then((r) => r.json())
      .then((d) => setMode(d.mode))
      .catch(() => {});
    return () => {
      cancelAnimationFrame(frame);
      abort.abort();
    };
  }, [open]);
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [messages, busy, open]);
  function close() {
    setOpen(false);
    trigger.current?.focus();
  }
  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const history = [...messages, {role: 'user' as const, content: text}];
    setMessages(history);
    setValue('');
    setBusy(true);
    setError('');
    const controller = new AbortController();
    pending.current = controller;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          messages: history
            .slice(1)
            .slice(-11)
            .map(({role, content}) => ({role, content})),
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.message || 'Please try again.');
      setMode(data.mode);
      setMessages((v) => [...v, {role: 'assistant', content: data.message, links: data.links}]);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : 'The chat is unavailable. Please message the team on WhatsApp.',
        );
    } finally {
      if (pending.current === controller) {
        pending.current = null;
        setBusy(false);
      }
    }
  }
  function reset() {
    pending.current?.abort();
    pending.current = null;
    setMessages([welcome]);
    setBusy(false);
    setError('');
    input.current?.focus();
  }
  return (
    <div className="trust-assistant">
      {open && (
        <section
          id="trust-chat-panel"
          className="trust-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="trust-chat-title"
          data-lenis-prevent
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.stopPropagation();
              close();
            }
          }}
        >
          <header className="trust-chat-header">
            <span className="trust-chat-symbol">
              <Bot size={23} />
            </span>
            <div>
              <h2 id="trust-chat-title">Ask the trust</h2>
              <p>{mode === 'groq' ? 'Your AI website assistant' : 'Your guide to our work'}</p>
            </div>
            <button onClick={reset} aria-label="Start a new chat">
              <RotateCcw size={17} />
            </button>
            <button onClick={close} aria-label="Close chat">
              <X size={21} />
            </button>
          </header>
          <div
            className="trust-chat-messages"
            ref={list}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((m, i) => (
              <div className={'trust-chat-message ' + m.role} key={i}>
                <p>{m.content}</p>
                {m.links && m.links.length > 0 && (
                  <div className="trust-chat-links">
                    {m.links.map((link) =>
                      link.href.startsWith('/') ? (
                        <Link href={link.href} key={link.href} onClick={close}>
                          {link.label}
                        </Link>
                      ) : (
                        <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
                          {link.label}
                        </a>
                      ),
                    )}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <p className="trust-chat-thinking" role="status">
                Preparing a reply…
              </p>
            )}
          </div>
          {messages.length === 1 && (
            <div className="trust-chat-suggestions">
              {['How can I donate books?', 'How do I volunteer?', 'Where are you located?'].map((q) => (
                <button disabled={busy} key={q} onClick={() => void send(q)}>
                  {q}
                </button>
              ))}
            </div>
          )}
          {error && (
            <p className="trust-chat-error" role="alert">
              {error}
            </p>
          )}
          <form
            className="trust-chat-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send(value);
            }}
          >
            <label className="sr-only" htmlFor="trust-chat-input">
              Your question
            </label>
            <input
              ref={input}
              id="trust-chat-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              maxLength={1000}
              autoComplete="off"
              placeholder="Ask a question…"
              disabled={busy}
            />
            <button disabled={busy || !value.trim()} aria-label="Send question">
              <Send size={19} />
            </button>
          </form>
          <p className="trust-chat-note">
            {mode === 'groq'
              ? 'AI can make mistakes. Please confirm arrangements with the team.'
              : 'For current arrangements, please check with the team.'}{' '}
            <Link href="/privacy" onClick={close}>
              Privacy
            </Link>
          </p>
        </section>
      )}
      <div className="trust-floating-actions">
        <button
          ref={trigger}
          className={'trust-chat-launcher' + (open ? ' active' : '')}
          onClick={() => (open ? close() : setOpen(true))}
          aria-label={open ? 'Close trust assistant' : 'Open trust assistant'}
          aria-expanded={open}
          aria-controls="trust-chat-panel"
        >
          <Bot size={24} />
        </button>
        <a
          className="trust-whatsapp-launcher"
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Message UT Charitable Trust on WhatsApp"
        >
          <Phone size={21} />
        </a>
      </div>
    </div>
  );
}
