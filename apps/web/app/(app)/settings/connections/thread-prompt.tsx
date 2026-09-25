'use client';

// Settings → Connections → "Build a thread from a document".
//
// Sjoerd, 2026-09-25: *"Can you add the prompt somewhere in the interface?
// e.g. in the documentation of help... or a chapter on AI"*.
//
// It sits here rather than in a help page because this is where somebody has
// just connected an assistant and is holding the question the prompt answers
// — "now what can it actually do for me?". A help article is where you go
// when you already know the thing exists.
//
// Collapsed by default. It is two dozen questions long, and a wall of prompt
// between "assistants connected" and the rest of the page would push
// everything else off the screen for the many visits that are not about this.

import { useState } from 'react';
import { ChevronDown, ChevronRight, Check, Copy } from 'lucide-react';
import { THREAD_PLAN_PROMPT } from '@thefibre/shared';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';

export function ThreadPromptCard({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(THREAD_PLAN_PROMPT).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      // A clipboard write can be refused (an insecure origin, a permission
      // policy). Saying nothing would look like a button that does nothing;
      // the text is on the screen and can be selected by hand.
      () => setCopied(false),
    );
  }

  return (
    <div className="rounded-lg border border-line bg-surface-raised">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 p-4 text-left hover:bg-surface-sunken/50 transition-colors rounded-lg"
      >
        {open ? (
          <ChevronDown size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-muted" />
        ) : (
          <ChevronRight size={16} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-muted" />
        )}
        <span className="min-w-0">
          <span className="block text-sm font-medium text-ink">
            {t(locale, 'thread_prompt_title')}
          </span>
          <span className="mt-0.5 block text-sm text-ink-subtle">
            {t(locale, 'thread_prompt_blurb')}
          </span>
        </span>
      </button>

      {open && (
        <div className="border-t border-line p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink-muted">{t(locale, 'thread_prompt_how')}</p>
            <Button type="button" variant="secondary" size="sm" onClick={copy}>
              {copied ? (
                <>
                  <Check size={14} strokeWidth={1.75} />
                  {t(locale, 'copied')}
                </>
              ) : (
                <>
                  <Copy size={14} strokeWidth={1.75} />
                  {t(locale, 'copy')}
                </>
              )}
            </Button>
          </div>
          {/* Selectable, so the copy button failing is an inconvenience
              rather than a dead end. Scrolls in its own box: it is long, and
              a settings page that grows a screen and a half of prose reads
              as broken. */}
          <pre className="mt-3 max-h-80 overflow-auto rounded-md border border-line bg-surface-sunken p-3 text-xs leading-relaxed text-ink-subtle whitespace-pre-wrap">
            {THREAD_PLAN_PROMPT.trim()}
          </pre>
        </div>
      )}
    </div>
  );
}
