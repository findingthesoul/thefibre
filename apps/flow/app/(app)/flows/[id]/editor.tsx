'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Rocket, AlertCircle, CheckCircle2 } from 'lucide-react';
import { saveGraph, publishFlow } from '../actions';

type Graph = {
  steps: unknown[];
  transitions: unknown[];
  step_default_tasks: unknown[];
};

// A starter graph shown when a flow has no steps yet — gives the user a
// working template to edit rather than a blank textarea.
const STARTER = {
  steps: [
    { key: 'first_contact', name: 'First Contact', kind: 'entry' },
    { key: 'in_progress', name: 'In Progress', kind: 'normal' },
    { key: 'won', name: 'Won', kind: 'end_positive' },
    { key: 'lost', name: 'Lost', kind: 'end_negative' },
  ],
  transitions: [
    {
      from: 'first_contact',
      to: 'in_progress',
      label: 'Start working',
      gate_logic: 'all',
      gate_tasks: [{ title: 'Discovery call done', actor_type: 'team', required: true }],
    },
    {
      from: 'in_progress',
      to: 'won',
      label: 'Mark won',
      gate_logic: 'all',
      gate_tasks: [
        {
          title: 'Contract signed',
          actor_type: 'contact',
          contact_action_type: 'signed_contract',
          required: true,
        },
      ],
    },
    { from: 'in_progress', to: 'lost', label: 'Mark lost', gate_logic: 'all', gate_tasks: [] },
  ],
  step_default_tasks: [
    { step: 'first_contact', title: 'Send intro email', actor_type: 'personal' },
  ],
};

export function FlowEditor({
  flowId,
  lifecycle,
  initialGraph,
}: {
  flowId: string;
  lifecycle: string;
  initialGraph: Graph;
}) {
  const router = useRouter();
  const hasSteps = (initialGraph.steps?.length ?? 0) > 0;
  const [text, setText] = useState(
    JSON.stringify(hasSteps ? initialGraph : STARTER, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Parse client-side first so a syntax error is reported instantly and
  // precisely (with line/column), rather than as a bare "not valid JSON"
  // after a server round-trip.
  function checkJson(): string | null {
    try {
      JSON.parse(text);
      return null;
    } catch (e) {
      return `Invalid JSON — ${e instanceof Error ? e.message : 'parse failed'}`;
    }
  }

  async function onSave() {
    const jsonErr = checkJson();
    if (jsonErr) {
      setError(jsonErr);
      setNotice(null);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await saveGraph(flowId, text);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNotice('Graph saved.');
    router.refresh();
  }

  async function onPublish() {
    const jsonErr = checkJson();
    if (jsonErr) {
      setError(jsonErr);
      setNotice(null);
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    // Save first so the latest edits are what gets published.
    const saved = await saveGraph(flowId, text);
    if (saved.error) {
      setBusy(false);
      setError(saved.error);
      return;
    }
    const res = await publishFlow(flowId);
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNotice('Published. The flow is now active.');
    router.refresh();
  }

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-medium">Graph definition</h2>
          <p className="text-xs text-ink-muted mt-0.5">
            Edit the JSON below. The visual canvas builder lands in a later
            phase — this is the same underlying graph.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onSave}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-line-strong disabled:opacity-60"
          >
            <Save size={15} strokeWidth={1.75} />
            Save draft
          </button>
          <button
            onClick={onPublish}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
          >
            <Rocket size={15} strokeWidth={1.75} />
            {lifecycle === 'active' ? 'Save & republish' : 'Publish'}
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        rows={26}
        className="w-full rounded-lg border border-line bg-white px-4 py-3 font-mono text-[12.5px] leading-relaxed focus:outline-none focus:ring-2 focus:ring-neutral-300"
      />

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}
      {notice && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 size={16} className="shrink-0" />
          {notice}
        </div>
      )}

      <div className="mt-6 rounded-md border border-line bg-surface-raised/40 px-4 py-3 text-xs text-ink-subtle leading-relaxed">
        <div className="font-medium text-ink mb-1">Schema</div>
        <ul className="space-y-0.5">
          <li>
            · <code className="font-mono">steps[]</code>: <code>key</code> (lowercase_snake),{' '}
            <code>name</code>, <code>kind</code> (entry | normal | end_positive | end_negative)
          </li>
          <li>
            · Exactly one <code>entry</code> step; at least one end step required to publish.
          </li>
          <li>
            · <code className="font-mono">transitions[]</code>: <code>from</code>, <code>to</code>{' '}
            (step keys), <code>label</code>, <code>gate_logic</code> (all | any),{' '}
            <code>gate_tasks[]</code>
          </li>
          <li>
            · gate task <code>actor_type</code>: personal | team | contact. Contact tasks need a{' '}
            <code>contact_action_type</code>.
          </li>
          <li>
            · <code className="font-mono">step_default_tasks[]</code>: <code>step</code> (key),{' '}
            <code>title</code>, <code>actor_type</code> — auto-created when a contact enters that
            step (Phase D).
          </li>
        </ul>
      </div>
    </div>
  );
}
