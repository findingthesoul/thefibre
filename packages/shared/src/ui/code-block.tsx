'use client';

// A block of code to paste somewhere else, with ONE copy button — every
// embed snippet, script tag and CSS sample a person is meant to copy.
//
// Sjoerd, 2026-10-16, on Thread → Settings → Website embeds: "please a copy
// button". The static snippets there had none, and three other places had
// each written their own (Thread's embed generator and per-thread embed
// panel, Members' embeds card). Components first: one here, the copies
// ported to it.
//
// Behaviour: a click (or Enter/Space — it is a real button) writes the code to
// the clipboard and the button says "Copied" with a check for two seconds;
// it presses visibly on the click itself. If the clipboard is refused (an
// insecure context, a denied permission) it says so instead of pretending.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { chromeT, useLocale } from './i18n-ui.js';

export function CodeBlock({
  code,
  label,
  className = '',
}: {
  code: string;
  /** Shown above the code, beside the copy button. */
  label?: ReactNode;
  className?: string;
}) {
  const locale = useLocale();
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState('copied');
    } catch {
      setState('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), 2000);
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 text-xs text-ink-subtle">{label}</span>
        <button
          type="button"
          onClick={copy}
          aria-live="polite"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-ink-subtle transition-transform hover:bg-surface-sunken hover:text-ink active:scale-95 focus:outline-none focus-visible:ring-1 focus-visible:ring-line-strong"
        >
          {state === 'copied' ? (
            <>
              <Check size={12} strokeWidth={2} className="text-emerald-600" aria-hidden />
              {chromeT(locale, 'code_copied')}
            </>
          ) : state === 'failed' ? (
            chromeT(locale, 'code_copy_failed')
          ) : (
            <>
              <Copy size={12} strokeWidth={1.75} aria-hidden />
              {chromeT(locale, 'code_copy')}
            </>
          )}
        </button>
      </div>
      <pre className="mt-1 overflow-x-auto rounded-lg border border-line bg-surface p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
