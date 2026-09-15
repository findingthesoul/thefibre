'use client';

// The in-app assistant panel — docs/assistant-in-app.md.
//
// Born shared (CLAUDE.md, "Components first"): The Thread mounts it first, the
// other apps mount the same component with their own `send`. The component
// knows nothing about the API or the model: it holds the conversation the
// server hands back, renders text, tool steps and one open proposal, and
// calls `send` — the app supplies that as a server action.
//
// Every visible string arrives through `labels`, translated by the app.
// Tokens and recipes only (docs/brand-design.md): no colours of its own.

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button } from './button.js';
import { CARD, INSET, NOTICE, SECTION_LABEL } from './recipes.js';
import { FIELD_CLASS } from './fields.js';

/** A model message as the server returns it. Opaque to the UI. */
export type AssistantMessage = { role: 'user' | 'assistant'; content: unknown };

export interface AssistantStep {
  tool: string;
  label: string;
  ok: boolean;
}

export interface AssistantPending {
  id: string;
  tool: string;
  label: string;
  input: Record<string, unknown>;
}

export interface AssistantRequest {
  messages: AssistantMessage[];
  approve?: string;
  decline?: string;
}

export interface AssistantResponse {
  messages: AssistantMessage[];
  reply: string;
  steps: AssistantStep[];
  pending: AssistantPending | null;
  error?: string;
}

export interface AssistantLabels {
  open: string;
  title: string;
  intro: string;
  placeholder: string;
  send: string;
  thinking: string;
  proposalTitle: string;
  approve: string;
  decline: string;
  newChat: string;
  close: string;
  failed: string;
  openThread: string;
}

export const ASSISTANT_LABELS_EN: AssistantLabels = {
  open: 'Ask',
  title: 'Assistant',
  intro: 'Ask about your threads, or say what you want to set up. Anything that changes something is shown to you first.',
  placeholder: 'Make a thread from a template…',
  send: 'Send',
  thinking: 'Thinking…',
  proposalTitle: 'Shall I do this?',
  approve: 'Yes, do it',
  decline: 'No',
  newChat: 'New conversation',
  close: 'Close',
  failed: 'The assistant could not answer. Try again.',
  openThread: 'Open the thread',
};

/** What the person sees: their own lines and the assistant's text. */
interface Line {
  role: 'user' | 'assistant';
  text: string;
  steps?: AssistantStep[];
  openPath?: string | null;
}

export interface AssistantPanelProps {
  send: (req: AssistantRequest) => Promise<AssistantResponse>;
  labels?: Partial<AssistantLabels>;
  suggestions?: string[];
  /** Called with a path when a step created something that has a page. */
  onNavigate?: (path: string) => void;
  /** Lift the button above a bottom tab bar on small screens. */
  bottomOffsetClassName?: string;
}

function openPathOf(messages: AssistantMessage[]): string | null {
  // The last tool_result that carries an open_path — the thread just created.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m || m.role !== 'user' || !Array.isArray(m.content)) continue;
    for (const b of m.content as { type?: string; content?: unknown }[]) {
      if (b.type !== 'tool_result' || typeof b.content !== 'string') continue;
      try {
        const parsed = JSON.parse(b.content) as { open_path?: string };
        if (parsed.open_path) return parsed.open_path;
      } catch {
        /* not JSON */
      }
    }
  }
  return null;
}

export function AssistantPanel({
  send,
  labels: partial,
  suggestions = [],
  onNavigate,
  bottomOffsetClassName = 'bottom-20 md:bottom-6',
}: AssistantPanelProps) {
  const L = { ...ASSISTANT_LABELS_EN, ...partial };
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [pending, setPending] = useState<AssistantPending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines, pending, busy]);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  async function turn(req: AssistantRequest, shown?: string) {
    setBusy(true);
    setError(null);
    if (shown) setLines((l) => [...l, { role: 'user', text: shown }]);
    try {
      const res = await send(req);
      if (res.error) {
        setError(res.error);
        return;
      }
      setMessages(res.messages);
      setPending(res.pending);
      const openPath = openPathOf(res.messages);
      if (res.reply || res.steps.length) {
        setLines((l) => [...l, { role: 'assistant', text: res.reply, steps: res.steps, openPath }]);
      }
    } catch {
      setError(L.failed);
    } finally {
      setBusy(false);
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || busy || pending) return;
    setDraft('');
    void turn({ messages: [...messages, { role: 'user', content: text }] }, text);
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function reset() {
    setMessages([]);
    setLines([]);
    setPending(null);
    setError(null);
    setDraft('');
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed right-4 ${bottomOffsetClassName} z-40 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-ink-inverse shadow-lg hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-line-strong`}
          aria-label={L.open}
        >
          <SparkIcon />
          {L.open}
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label={L.title}
          className={`fixed right-4 ${bottomOffsetClassName} z-40 flex w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden ${CARD} shadow-xl`}
          style={{ height: 'min(38rem, 75dvh)' }}
        >
          <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2">
              <SparkIcon />
              <h2 className="text-sm font-medium text-ink">{L.title}</h2>
            </div>
            <div className="flex items-center gap-1">
              {lines.length > 0 && (
                <Button variant="ghost" size="sm" onClick={reset} disabled={busy}>
                  {L.newChat}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label={L.close}>
                <span aria-hidden>×</span>
              </Button>
            </div>
          </header>

          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {lines.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-ink-subtle">{L.intro}</p>
                {suggestions.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className={`${INSET} px-3 py-1.5 text-left text-xs text-ink hover:bg-surface-raised`}
                        onClick={() => {
                          setDraft(s);
                          input.current?.focus();
                        }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {lines.map((line, i) => (
              <div key={i} className={line.role === 'user' ? 'flex justify-end' : ''}>
                <div
                  className={
                    line.role === 'user'
                      ? 'max-w-[85%] rounded-lg bg-ink px-3 py-2 text-sm text-ink-inverse whitespace-pre-wrap'
                      : 'max-w-[95%] space-y-2'
                  }
                >
                  {line.steps && line.steps.length > 0 && (
                    <ul className="space-y-0.5">
                      {line.steps.map((s, j) => (
                        <li key={j} className={`${SECTION_LABEL} ${s.ok ? '' : 'text-red-700'}`}>
                          {s.ok ? '✓' : '✗'} {s.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  {line.text && (
                    <p className={line.role === 'user' ? '' : 'text-sm text-ink whitespace-pre-wrap'}>{line.text}</p>
                  )}
                  {line.openPath && onNavigate && (
                    <Button variant="secondary" size="sm" onClick={() => onNavigate(line.openPath!)}>
                      {L.openThread}
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {pending && (
              <div className={`${INSET} space-y-2 p-3`}>
                <p className={SECTION_LABEL}>{L.proposalTitle}</p>
                <p className="text-sm text-ink">{pending.label}</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-subtle">
                  {Object.entries(pending.input)
                    .filter(([, v]) => v !== null && v !== undefined && v !== '')
                    .map(([k, v]) => (
                      <div key={k} className="contents">
                        <dt className="text-ink-muted">{k.replace(/_/g, ' ')}</dt>
                        <dd className="truncate">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
                      </div>
                    ))}
                </dl>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void turn({ messages, decline: pending.id })}
                  >
                    {L.decline}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={busy}
                    onClick={() => void turn({ messages, approve: pending.id })}
                  >
                    {L.approve}
                  </Button>
                </div>
              </div>
            )}

            {busy && <p className="text-xs text-ink-muted">{L.thinking}</p>}
            {error && <p className={`${NOTICE.error} text-xs`}>{error}</p>}
          </div>

          <form onSubmit={submit} className="border-t border-line p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={input}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKey}
                rows={1}
                placeholder={L.placeholder}
                disabled={busy || !!pending}
                className={`${FIELD_CLASS} max-h-32 min-h-[2.25rem] flex-1 resize-none`}
              />
              <Button type="submit" variant="primary" size="sm" disabled={busy || !!pending || !draft.trim()}>
                {L.send}
              </Button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

function SparkIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </svg>
  );
}
