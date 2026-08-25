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

export function ImportDesign({ flowId, flowName }: { flowId: string; flowName: string }) {
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
      setError(res.error ?? 'export failed');
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
        title="Import or export this flow as a JSON design file"
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-line-strong"
      >
        <FileJson size={15} strokeWidth={1.75} /> Design file
      </button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          reset();
        }}
        size="xl"
        title="Import design"
        description="Paste or choose a JSON design file. Nothing changes until you have seen what it will do."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Cancel
            </Button>
            {plan ? (
              <Button onClick={onApply} disabled={busy} leading={<Upload size={15} />}>
                {busy ? 'Importing…' : 'Import'}
              </Button>
            ) : (
              <Button onClick={onCheck} disabled={busy || !text.trim()}>
                {busy ? 'Checking…' : 'Check'}
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
              Choose file…
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onExport}
              disabled={busy}
              leading={<ArrowDownToLine size={15} />}
            >
              Export this flow
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

          {plan && <Plan plan={plan} />}
        </div>
      </Dialog>
    </>
  );
}

function Plan({ plan }: { plan: ImportPlan }) {
  const { steps, transitions, step_default_tasks: defaults, target_version: target } = plan;

  // Warnings, loudest first. Everything here is a reason to look twice, not a
  // reason the import will fail.
  const warnings: string[] = [];
  if (target.creates_new_version) {
    warnings.push(
      `This flow's latest version is published, so importing creates version ${target.version_number}. ` +
        (plan.run_count > 0
          ? `The ${plan.run_count} existing run${plan.run_count === 1 ? '' : 's'} stay on the version they started on until you publish.`
          : 'Nothing is running on it yet.'),
    );
  } else if (plan.run_count > 0) {
    warnings.push(
      `Replacing the draft in place. ${plan.run_count} run${plan.run_count === 1 ? '' : 's'} exist on this flow — they are pinned to their own version and are not touched.`,
    );
  }
  if (plan.removed_step_keys.length) {
    warnings.push(
      `${plan.removed_step_keys.length} step${plan.removed_step_keys.length === 1 ? '' : 's'} in the draft are not in this file and will disappear: ${plan.removed_step_keys.join(', ')}.`,
    );
  }
  if (plan.flow.system_key_taken_by) {
    warnings.push(
      `Another flow ("${plan.flow.system_key_taken_by}") already holds that system key. The import will be refused.`,
    );
  }

  return (
    <div className="rounded-md border border-line bg-surface-sunken px-3 py-3 text-sm space-y-3">
      <div className="flex items-center gap-1.5 font-medium text-ink">
        <CheckCircle2 size={15} className="text-emerald-600" /> Valid. Here is what Import will do:
      </div>

      <ul className="space-y-1 text-ink-subtle">
        <Row label="Steps" incoming={steps.incoming} replacing={steps.replacing} />
        <Row label="Transitions" incoming={transitions.incoming} replacing={transitions.replacing} />
        <Row label="Default tasks" incoming={defaults.incoming} replacing={defaults.replacing} />
        <li>
          Lands on <strong className="text-ink">version {target.version_number}</strong>
          {target.creates_new_version ? ' (new draft)' : ' (existing draft)'}.
        </li>
        {plan.flow.progression && (
          <li>
            Progression <strong className="text-ink">{plan.flow.progression.from}</strong> →{' '}
            <strong className="text-ink">{plan.flow.progression.to}</strong>.
          </li>
        )}
        {plan.flow.system_key && (
          <li>
            System key{' '}
            <strong className="text-ink">{plan.flow.system_key.from ?? '(none)'}</strong> →{' '}
            <strong className="text-ink">{plan.flow.system_key.to ?? '(none)'}</strong>.
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

function Row({ label, incoming, replacing }: { label: string; incoming: number; replacing: number }) {
  return (
    <li>
      <strong className="text-ink">
        {incoming} {label.toLowerCase()}
      </strong>{' '}
      replacing {replacing}.
    </li>
  );
}
