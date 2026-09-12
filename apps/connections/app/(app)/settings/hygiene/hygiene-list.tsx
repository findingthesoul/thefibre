'use client';

// The hygiene review queue.
//
// docs/connections-data-integrity.md §9.3. The sweep proposes; this is where
// a person decides. Two buttons, no bulk action — a "fix everything" button
// would recreate the silent repair this whole design refuses, with one click
// of ceremony in front of it.

import { useState, useTransition } from 'react';
import { Check, X } from 'lucide-react';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { actOnFinding } from '../actions';

export type Finding = {
  id: string;
  kind: string;
  subject_table: string;
  subject_id: string;
  related_id: string | null;
  evidence: Record<string, unknown>;
  status: string;
  created_at: string;
  subject_name: string | null;
  related_name: string | null;
};

// Explicit map, never a computed key: the catalog is typed so a missing
// translation is a compile error, and a template key throws that away.
const KIND_KEYS: Record<string, UiKey> = {
  duplicate_person: 'hyg_duplicate_person',
  ghost_record: 'hyg_ghost_record',
  stranded_run: 'hyg_stranded_run',
  email_formatting: 'hyg_email_formatting',
  empty_draft: 'hyg_empty_draft',
};

/**
 * The evidence, in words. Rendered from the jsonb the sweep attached rather
 * than from a sentence the sweep wrote, so the interface can phrase it in six
 * languages and a person can judge a proposal without trusting the sweep.
 */
function evidenceLine(f: Finding, locale: Locale): string {
  const e = f.evidence ?? {};
  if (f.kind === 'duplicate_person') {
    const score = typeof e.score === 'number' ? Math.round(e.score * 100) : null;
    return [e.reason, score !== null ? `${score}%` : null].filter(Boolean).join(' · ');
  }
  if (f.kind === 'email_formatting') return `${e.before ?? ''} → ${e.after ?? ''}`;
  if (f.kind === 'stranded_run' && e.at_step_since) {
    const days = Math.floor((Date.now() - new Date(String(e.at_step_since)).getTime()) / 86_400_000);
    return t(locale, 'hyg_days_at_step', { n: days });
  }
  if (f.kind === 'ghost_record') return String(e.email ?? '');
  if (f.kind === 'empty_draft') return t(locale, 'hyg_draft_removed');
  return '';
}

export function HygieneList({
  items,
  locale,
  canAct,
}: {
  items: Finding[];
  locale: Locale;
  canAct: boolean;
}) {
  const [resolved, setResolved] = useState<Set<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const open = items.filter((f) => f.status === 'open' && !resolved.has(f.id));
  const applied = items.filter((f) => f.status === 'fixed');

  function act(id: string, action: 'accept' | 'dismiss') {
    setError(null);
    startTransition(async () => {
      const r = await actOnFinding(id, action);
      if (r.ok) setResolved((s) => new Set(s).add(id));
      else setError(r.error);
    });
  }

  return (
    <div className="mt-8 space-y-10">
      <section>
        <h2 className="text-sm font-medium">{t(locale, 'hyg_to_review')}</h2>
        {open.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">{t(locale, 'hyg_nothing_to_review')}</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {open.map((f) => (
              <li
                key={f.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-md border border-line bg-surface-raised px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {t(locale, KIND_KEYS[f.kind] ?? 'hyg_unknown_kind')}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-ink-muted">
                    {f.subject_name ?? f.subject_id.slice(0, 8)}
                    {f.related_name && ` · ${f.related_name}`}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-subtle">{evidenceLine(f, locale)}</div>
                </div>

                {canAct && (
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => act(f.id, 'accept')}
                      title={t(locale, 'hyg_accept_hint')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs hover:bg-surface-sunken disabled:opacity-50"
                    >
                      <Check size={13} /> {t(locale, 'hyg_real')}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => act(f.id, 'dismiss')}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-3 text-xs text-ink-muted hover:bg-surface-sunken disabled:opacity-50"
                    >
                      <X size={13} /> {t(locale, 'hyg_not_real')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {error && <p className="mt-2 text-xs text-ink">{error}</p>}
      </section>

      {/* Changes already made, shown rather than hidden. "We changed your data
          and told nobody" is the thing the queue exists to prevent, so the
          safe fixes are listed even though nobody has to do anything. */}
      {applied.length > 0 && (
        <section>
          <h2 className="text-sm font-medium">{t(locale, 'hyg_already_done')}</h2>
          <p className="mt-1 text-xs text-ink-subtle">{t(locale, 'hyg_already_done_note')}</p>
          <ul className="mt-3 space-y-1.5">
            {applied.map((f) => (
              <li key={f.id} className="rounded-md border border-line px-3 py-2 text-xs">
                <span className="font-medium">
                  {t(locale, KIND_KEYS[f.kind] ?? 'hyg_unknown_kind')}
                </span>
                <span className="ml-2 text-ink-muted">
                  {f.subject_name ?? f.subject_id.slice(0, 8)}
                </span>
                <span className="ml-2 text-ink-subtle">{evidenceLine(f, locale)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
