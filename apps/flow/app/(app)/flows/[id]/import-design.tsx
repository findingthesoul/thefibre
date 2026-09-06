'use client';

// Import a flow design as JSON.
//
// A nine-step method with 39 default tasks is an afternoon of typing in the
// builder, and a transcription error is invisible until someone reads a step
// and finds the wrong trap under it. This hands the same JSON the builder
// already saves — and that GET /flows/:id/graph now exports — straight to the
// API instead.
//
// The one rule this screen exists to honour: importing REPLACES every step of
// the target version. So nothing applies until the plan has been shown.

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowDownToLine,
  CheckCircle2,
  FileJson,
  Upload,
} from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { previewImport, importDesign, exportDesign, type ImportPlan } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

export function ImportDesign({
  flowId,
  flowName,
  locale,
}: {
  flowId: string;
  flowName: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function reset() {
    setText('');
    setPlan(null);
    setError(null);
    setBusy(false);
  }

  // Any edit invalidates the plan — a preview that no longer describes the
  // text in the box is worse than no preview.
  function onText(v: string) {
    setText(v);
    setPlan(null);
    setError(null);
  }

  async function onFile(f: File | null) {
    if (!f) return;
    onText(await f.text());
  }

  async function onCheck() {
    setBusy(true);
    setError(null);
    const res = await previewImport(flowId, text);
    setBusy(false);
    if (res.error) {
      setPlan(null);
      setError(res.error);
      return;
    }
    setPlan(res.data ?? null);
  }

  async function onApply() {
    setBusy(true);
    setError(null);
    const res = await importDesign(flowId, text);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setOpen(false);
    reset();
    router.refresh();
  }

  async function onExport() {
    setBusy(true);
    const res = await exportDesign(flowId);
    setBusy(false);
    if (res.error || !res.data) {
      setError(res.error ?? t(locale, 'export_failed'));
      return;
    }
    const slug = flowName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'flow';
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-design.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={t(locale, 'design_file_title')}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-line-strong"
      >
        <FileJson size={15} strokeWidth={1.75} /> {t(locale, 'design_file')}
      </button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        size="xl"
        title={t(locale, 'import_design')}
        description={t(locale, 'import_design_desc')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              {t(locale, 'cancel')}
            </Button>
            {plan ? (
              <Button onClick={onApply} disabled={busy} leading={<Upload size={15} />}>
                {busy ? t(locale, 'importing') : t(locale, 'import')}
              </Button>
            ) : (
              <Button onClick={onCheck} disabled={busy || !text.trim()}>
                {busy ? t(locale, 'checking') : t(locale, 'check')}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              {t(locale, 'choose_file')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExport}
              disabled={busy}
              leading={<ArrowDownToLine size={15} />}
            >
              {t(locale, 'export_this_flow')}
            </Button>
          </div>

          <textarea
            value={text}
            onChange={(e) => onText(e.target.value)}
            spellCheck={false}
            rows={12}
            placeholder={'{\n  "flow": { "progression": "open" },\n  "steps": [ … ],\n  "transitions": [ … ],\n  "step_default_tasks": [ … ]\n}'}
            className="w-full rounded-md border border-line bg-surface-raised px-3 py-2 font-mono text-xs leading-relaxed text-ink"
          />

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span className="whitespace-pre-wrap break-words">{error}</span>
            </div>
          )}

          {plan && <Plan plan={plan} locale={locale} />}
        </div>
      </Dialog>
    </>
  );
}

function Plan({ plan, locale }: { plan: ImportPlan; locale: Locale }) {
  const { steps, transitions, step_default_tasks: defaults, target_version: target } = plan;

  // Warnings, loudest first. Everything here is a reason to look twice, not a
  // reason the import will fail.
  const warnings: string[] = [];
  if (target.creates_new_version) {
    warnings.push(
      t(locale, 'warn_creates_version', { v: target.version_number }) +
        ' ' +
        (plan.run_count > 0
          ? plan.run_count === 1
            ? t(locale, 'warn_runs_stay_one')
            : t(locale, 'warn_runs_stay_many', { n: plan.run_count })
          : t(locale, 'warn_nothing_running')),
    );
  } else if (plan.run_count > 0) {
    warnings.push(
      plan.run_count === 1
        ? t(locale, 'warn_replace_draft_one')
        : t(locale, 'warn_replace_draft_many', { n: plan.run_count }),
    );
  }
  if (plan.removed_step_keys.length) {
    warnings.push(
      plan.removed_step_keys.length === 1
        ? t(locale, 'warn_removed_one', { keys: plan.removed_step_keys.join(', ') })
        : t(locale, 'warn_removed_many', {
            n: plan.removed_step_keys.length,
            keys: plan.removed_step_keys.join(', '),
          }),
    );
  }
  if (plan.flow.system_key_taken_by) {
    warnings.push(t(locale, 'warn_system_key_taken', { name: plan.flow.system_key_taken_by }));
  }

  return (
    <div className="rounded-md border border-line bg-surface-sunken px-3 py-3 text-sm space-y-3">
      <div className="flex items-center gap-1.5 font-medium text-ink">
        <CheckCircle2 size={15} className="text-emerald-600" /> {t(locale, 'plan_valid_heading')}
      </div>

      <ul className="space-y-1 text-ink-subtle">
        <Row label={t(locale, 'row_steps')} incoming={steps.incoming} replacing={steps.replacing} locale={locale} />
        <Row
          label={t(locale, 'row_transitions')}
          incoming={transitions.incoming}
          replacing={transitions.replacing}
          locale={locale}
        />
        <Row
          label={t(locale, 'row_default_tasks')}
          incoming={defaults.incoming}
          replacing={defaults.replacing}
          locale={locale}
        />
        <li>
          {t(locale, 'lands_on_version')}{' '}
          <strong className="text-ink">{t(locale, 'version_n', { n: target.version_number })}</strong>{' '}
          {target.creates_new_version
            ? t(locale, 'new_draft_suffix')
            : t(locale, 'existing_draft_suffix')}
        </li>
        {plan.flow.progression && (
          <li>
            {t(locale, 'progression_label')}{' '}
            <strong className="text-ink">{plan.flow.progression.from}</strong> →{' '}
            <strong className="text-ink">{plan.flow.progression.to}</strong>.
          </li>
        )}
        {plan.flow.system_key && (
          <li>
            {t(locale, 'system_key_label')}{' '}
            <strong className="text-ink">{plan.flow.system_key.from ?? t(locale, 'none_paren')}</strong> →{' '}
            <strong className="text-ink">{plan.flow.system_key.to ?? t(locale, 'none_paren')}</strong>.
          </li>
        )}
      </ul>

      {warnings.map((w) => (
        <div key={w} className="flex items-start gap-2 text-amber-800">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>{w}</span>
        </div>
      ))}
    </div>
  );
}

function Row({
  label,
  incoming,
  replacing,
  locale,
}: {
  label: string;
  incoming: number;
  replacing: number;
  locale: Locale;
}) {
  return (
    <li>
      <strong className="text-ink">
        {incoming} {label}
      </strong>{' '}
      {t(locale, 'row_replacing', { m: replacing })}
    </li>
  );
}
