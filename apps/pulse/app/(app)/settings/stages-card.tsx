'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { updateStage } from './actions';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';
import { ERROR_CLS, INPUT_CLS, type Stage } from './shared';

// The pipeline is authored in Fibre Flow (flow "Pipeline", seeded with
// Pulse, undeletable while Pulse is active). This card is Pulse's READ-ONLY
// reflection of that flow — plus the one thing that IS Pulse's to edit:
// the money semantics (`kind`) each step carries in the projection.

const KIND_BADGE: Record<string, string> = {
  open: 'bg-amber-50 text-amber-600',
  committed: 'bg-emerald-50 text-emerald-600',
  won: 'bg-slate-100 text-slate-500',
  lost: 'bg-slate-50 text-slate-400',
};

const KIND_OPTIONS = [
  { value: 'open', labelKey: 'kind_open' },
  { value: 'committed', labelKey: 'kind_committed' },
  { value: 'won', labelKey: 'kind_won' },
  { value: 'lost', labelKey: 'kind_lost' },
] as const satisfies readonly { value: string; labelKey: UiKey }[];
type StageKind = (typeof KIND_OPTIONS)[number]['value'];

// The short badge label for a stage kind — unknown kinds show raw.
function kindBadge(locale: Locale, kind: string): string {
  if (kind === 'open') return t(locale, 'kind_open_badge');
  if (kind === 'committed') return t(locale, 'kind_committed_badge');
  if (kind === 'won') return t(locale, 'kind_won_badge');
  if (kind === 'lost') return t(locale, 'kind_lost_badge');
  return kind;
}

export function StagesCard({
  stages,
  flowUrl,
  locale,
}: {
  stages: Stage[];
  flowUrl: string | null;
  locale: Locale;
}) {
  const [editing, setEditing] = useState<Stage | null>(null);
  const sorted = [...stages].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section className="rounded-2xl bg-white ring-1 ring-black/5 shadow-card">
      <div className="px-5 py-3 border-b border-line flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">{t(locale, 'pipeline_stages')}</span>
        {flowUrl && (
          <a
            href={flowUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-ink-subtle hover:text-ink hover:underline"
          >
            {t(locale, 'edit_flow_in_flow')}
            <ExternalLink size={13} strokeWidth={1.75} />
          </a>
        )}
      </div>
      <p className="px-5 py-3 text-sm text-ink-muted border-b border-line/60">
        {t(locale, 'stages_blurb_a')}
        <em>{t(locale, 'stages_blurb_em')}</em>
        {t(locale, 'stages_blurb_b')}
      </p>
      {sorted.length === 0 ? (
        <div className="px-5 py-4 text-sm text-ink-muted">{t(locale, 'no_stages')}</div>
      ) : (
        <div className="divide-y divide-line/60">
          {sorted.map((s) => (
            <div key={s.id} className="px-5 py-3 flex items-center gap-3">
              <span className="text-xs text-ink-muted w-5 text-right tabular-nums">
                {s.sort_order}
              </span>
              <span className="flex-1 min-w-0 text-sm text-ink truncate">
                {s.label}
                {s.is_system && (
                  <span className="ml-2 text-xs font-normal text-ink-muted">
                    {t(locale, 'default_flow')}
                  </span>
                )}
              </span>
              {/* Default probability rows take on entering this stage —
                  committed/won force 100 regardless, so no chip there. */}
              {s.default_probability != null && s.kind !== 'committed' && s.kind !== 'won' && (
                <span
                  title={t(locale, 'default_prob_title')}
                  className="shrink-0 text-xs text-ink-muted tabular-nums"
                >
                  {s.default_probability}%
                </span>
              )}
              <button
                type="button"
                onClick={() => setEditing(s)}
                title={t(locale, 'change_kind_title')}
                className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize hover:ring-1 hover:ring-line ${
                  KIND_BADGE[s.kind] ?? 'bg-slate-50 text-slate-500'
                }`}
              >
                {kindBadge(locale, s.kind)}
              </button>
            </div>
          ))}
        </div>
      )}
      {editing && <KindDialog stage={editing} locale={locale} onClose={() => setEditing(null)} />}
    </section>
  );
}

function KindDialog({
  stage,
  locale,
  onClose,
}: {
  stage: Stage;
  locale: Locale;
  onClose: () => void;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<StageKind>(
    KIND_OPTIONS.some((k) => k.value === stage.kind) ? (stage.kind as StageKind) : 'open',
  );
  // Default probability rows take on entering the stage. Empty = none (the
  // row keeps its current value); committed/won force 100 regardless.
  const [defaultProb, setDefaultProb] = useState(
    stage.default_probability != null ? String(stage.default_probability) : '',
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const probIrrelevant = kind === 'committed' || kind === 'won';

  async function submit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    let prob: number | null = null;
    if (defaultProb.trim() !== '') {
      const n = parseInt(defaultProb.trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        setError(t(locale, 'prob_range_error'));
        return;
      }
      prob = n;
    }
    setBusy(true);
    setError(null);
    const res = await updateStage(stage.id, { kind, default_probability: prob });
    if (res.error) {
      setError(res.error);
      setBusy(false);
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t(locale, 'money_semantics_title', { stage: stage.label })}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="stage-kind-form" disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </>
      }
    >
      <form id="stage-kind-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t(locale, 'how_money_counts')}</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as StageKind)}
            className={INPUT_CLS}
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {t(locale, k.labelKey)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-muted">{t(locale, 'stages_sync_hint')}</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">
            {t(locale, 'default_probability_pct')}
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={defaultProb}
            onChange={(e) => setDefaultProb(e.target.value)}
            placeholder={t(locale, 'prob_none_ph')}
            disabled={probIrrelevant}
            className={`${INPUT_CLS} disabled:opacity-60`}
          />
          <p className="mt-1 text-xs text-ink-muted">
            {probIrrelevant ? t(locale, 'prob_committed_hint') : t(locale, 'prob_open_hint')}
          </p>
        </div>
        {error && <div className={ERROR_CLS}>{error}</div>}
      </form>
    </Dialog>
  );
}
