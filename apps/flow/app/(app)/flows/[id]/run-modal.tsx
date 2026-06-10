'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  X,
  GripVertical,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ExternalLink,
  List as ListIcon,
  Workflow,
  Send,
  MoveRight,
} from 'lucide-react';
import Link from 'next/link';
import { getRunDetail, transitionRun, completeTask, reopenTask, repositionRun, addRunNote } from '../actions';

type Kind = 'entry' | 'normal' | 'end_positive' | 'end_negative' | 'loop';
type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };
type Task = {
  id: string;
  title: string;
  actor_type: string;
  status: string;
  gate_task_id: string | null;
};
type Transition = {
  id: string;
  label: string;
  gate_logic: string;
  to_step: { key: string; name: string; kind: string } | null;
  gate_satisfied: boolean;
  gate_task_count: number;
};
type GraphStep = { key: string; name: string; kind: Kind; canvas_x?: number | null; canvas_y?: number | null };
type GraphTransition = { from: string; to: string; label: string };
type Detail = {
  run: {
    id: string;
    flow_id: string;
    status: string;
    person: Person | Person[] | null;
    step: { id: string; key: string; name: string; kind: string } | null;
  };
  tasks: Task[];
  notes: Note[];
  transitions: Transition[];
  graph: { steps: GraphStep[]; transitions: GraphTransition[] };
};

type Note = {
  id: string;
  body: string;
  created_at: string;
  step: { key: string } | { key: string }[] | null;
  author: { full_name: string | null; email: string | null } | { full_name: string | null; email: string | null }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}
function personName(p: Person | null): string {
  if (!p) return 'Unknown';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown';
}
function initials(p: Person | null): string {
  if (!p) return '?';
  const f = p.first_name?.[0] ?? '';
  const l = p.last_name?.[0] ?? '';
  return (f + l || p.email?.[0] || '?').toUpperCase();
}

// White cards; kind shown as a small coloured dot (clean-dashboard style).
const KIND_DOT: Record<string, string> = {
  entry: 'bg-indigo-500',
  normal: 'bg-slate-300',
  end_positive: 'bg-emerald-500',
  end_negative: 'bg-rose-500',
  loop: 'bg-amber-500',
};

type RunNodeData = {
  label: string;
  kind: string;
  isCurrent: boolean;
  isTarget: boolean; // forward (gated) transition target
  dragging: boolean;
  picking: boolean;
  token: string | null;
  onTokenDragStart: () => void;
  onTokenDragEnd: () => void;
  onDropToken: (key: string) => void;
  stepKey: string;
};

function RunStepNode({ data }: NodeProps) {
  const d = data as RunNodeData;
  const dot = KIND_DOT[d.kind] ?? KIND_DOT.normal;
  const moving = d.dragging || d.picking;
  // Forward (gated) target → amber. Any other non-current step → a neutral
  // "manual move" target (revert / sideways) while moving.
  const forwardActive = moving && d.isTarget;
  const manualActive = moving && !d.isCurrent && !d.isTarget;
  const clickable = d.isCurrent || forwardActive || manualActive;
  return (
    <div
      onDragOver={(e) => {
        if (!d.isCurrent) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (!d.isCurrent) d.onDropToken(d.stepKey);
      }}
      className={`rounded-2xl bg-white transition-shadow ${
        d.isCurrent ? 'ring-2 ring-slate-800 shadow-lg' : 'ring-1 ring-black/5 shadow-md'
      } ${forwardActive ? 'outline outline-2 outline-dashed outline-amber-400' : ''} ${
        manualActive ? 'outline outline-1 outline-dashed outline-slate-400' : ''
      } ${clickable ? 'cursor-pointer' : ''}`}
      style={{ width: 176 }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="px-3.5 py-2.5 min-h-[52px] flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
          <span className="text-[13px] font-medium leading-tight truncate">{d.label}</span>
        </span>
        {d.token && (
          <span
            draggable
            onDragStart={d.onTokenDragStart}
            onDragEnd={d.onTokenDragEnd}
            title="Click the card to pick up / drop, then click a highlighted step — or drag"
            className={`inline-flex items-center gap-1 rounded-full text-[11px] font-medium pl-1.5 pr-2 py-1 shrink-0 ${
              d.picking ? 'bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse' : 'bg-neutral-900 text-white'
            }`}
          >
            <GripVertical size={11} />
            {d.token}
          </span>
        )}
        {forwardActive && <ArrowRight size={14} className="text-amber-600 shrink-0" />}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

// Longest-path depth of each step from the entry (cycle-safe). Used to tell
// whether a manual move goes forward or backward in the flow.
function stepDepths(steps: GraphStep[], transitions: GraphTransition[]): Map<string, number> {
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const depth = new Map<string, number>();
  for (const s of steps) depth.set(s.key, 0);
  for (let pass = 0; pass < steps.length + 1; pass++) {
    let changed = false;
    for (const t of transitions) {
      if (!byKey.has(t.from) || !byKey.has(t.to)) continue;
      const nd = (depth.get(t.from) ?? 0) + 1;
      if (nd > (depth.get(t.to) ?? 0) && nd <= steps.length) {
        depth.set(t.to, nd);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}

function autoPositions(steps: GraphStep[], transitions: GraphTransition[]) {
  const pos = new Map<string, { x: number; y: number }>();
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const depth = new Map<string, number>();
  for (const s of steps) depth.set(s.key, 0);
  for (let pass = 0; pass < steps.length + 1; pass++) {
    let changed = false;
    for (const t of transitions) {
      if (!byKey.has(t.from) || !byKey.has(t.to)) continue;
      const nd = (depth.get(t.from) ?? 0) + 1;
      if (nd > (depth.get(t.to) ?? 0) && nd <= steps.length) {
        depth.set(t.to, nd);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const rows = new Map<number, number>();
  for (const s of steps) {
    const dd = depth.get(s.key) ?? 0;
    const r = rows.get(dd) ?? 0;
    rows.set(dd, r + 1);
    pos.set(s.key, { x: 30 + dd * 232, y: 30 + r * 100 });
  }
  return pos;
}

function Graph({
  detail,
  dragging,
  setDragging,
  picking,
  setPicking,
  onDropToken,
}: {
  detail: Detail;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  picking: boolean;
  setPicking: (v: boolean) => void;
  onDropToken: (key: string) => void;
}) {
  const person = one(detail.run.person);
  const currentKey = detail.run.step?.key;
  const targetKeys = new Set(detail.transitions.map((t) => t.to_step?.key).filter(Boolean) as string[]);
  const pos = useMemo(
    () => autoPositions(detail.graph.steps, detail.graph.transitions),
    [detail.graph],
  );

  const nodes: Node[] = detail.graph.steps.map((s) => ({
    id: s.key,
    type: 'runStep',
    position:
      s.canvas_x != null && s.canvas_y != null ? { x: s.canvas_x, y: s.canvas_y } : pos.get(s.key) ?? { x: 30, y: 30 },
    data: {
      label: s.name,
      kind: s.kind,
      stepKey: s.key,
      isCurrent: s.key === currentKey,
      isTarget: targetKeys.has(s.key),
      dragging,
      picking,
      token: s.key === currentKey ? initials(person) : null,
      onTokenDragStart: () => setDragging(true),
      onTokenDragEnd: () => setDragging(false),
      onDropToken,
    } as RunNodeData,
  }));

  const edges: Edge[] = detail.graph.transitions.map((t, i) => ({
    id: `e${i}`,
    source: t.from,
    target: t.to,
    label: t.label,
    animated: t.from === currentKey,
  }));

  const nodeTypes = useMemo(() => ({ runStep: RunStepNode }), []);

  // Reliable click handling via React Flow's own node-click event (inner-DOM
  // onClick gets swallowed by the node wrapper). Click the current step to
  // pick up / drop the token; while picking, click a reachable step to move.
  const onNodeClick = (_: unknown, node: Node) => {
    if (node.id === currentKey) {
      setPicking(!picking);
    } else if (picking) {
      // Any non-current step is a target: forward (gated) or manual (revert).
      onDropToken(node.id);
    }
  };

  return (
    <div style={{ height: 380 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: '#f8fafc' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.8} color="#cbd5e1" />
      </ReactFlow>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Journey list view: steps stacked vertically (non-current muted), transition
// labels on the connectors between them, the current step as a thick card
// with its tasks, and a note composer on every step.
// ---------------------------------------------------------------------------
function JourneyList({
  detail,
  busy,
  onMoveTo,
  onToggleTask,
  onAddNote,
}: {
  detail: Detail;
  busy: boolean;
  onMoveTo: (key: string) => void;
  onToggleTask: (t: Task) => void;
  onAddNote: (stepKey: string, body: string) => void;
}) {
  const steps = [...detail.graph.steps].sort(
    (a, b) =>
      (a.canvas_x ?? Number.MAX_SAFE_INTEGER) - (b.canvas_x ?? Number.MAX_SAFE_INTEGER) ||
      (a.canvas_y ?? 0) - (b.canvas_y ?? 0),
  );
  const currentKey = detail.run.step?.key;
  const tasks = detail.tasks.filter((t) => t.status !== 'cancelled');

  const notesByStep = new Map<string, Note[]>();
  for (const n of detail.notes ?? []) {
    const key = one(n.step)?.key;
    if (!key) continue;
    notesByStep.set(key, [...(notesByStep.get(key) ?? []), n]);
  }

  return (
    <div className="max-h-[62vh] overflow-y-auto px-5 py-4">
      {steps.map((s, i) => {
        const isCurrent = s.key === currentKey;
        const between =
          i > 0 ? detail.graph.transitions.filter((t) => t.from === steps[i - 1].key && t.to === s.key) : [];
        const notes = notesByStep.get(s.key) ?? [];
        return (
          <div key={s.key}>
            {i > 0 && (
              <div className="flex items-center gap-2.5 py-1 ml-5">
                <div className="h-7 w-px bg-slate-300" />
                {between.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white ring-1 ring-black/5 px-2 py-0.5 text-[10px] text-ink-subtle">
                    <ArrowDown size={10} />
                    {between.map((t) => t.label).join(' · ')}
                  </span>
                )}
              </div>
            )}
            <div
              className={
                isCurrent
                  ? 'rounded-2xl bg-white ring-2 ring-slate-800 shadow-card px-4 py-3'
                  : 'rounded-xl bg-white/70 ring-1 ring-black/5 px-4 py-2.5 opacity-70'
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${KIND_DOT[s.kind] ?? KIND_DOT.normal}`} />
                  <span className={`truncate ${isCurrent ? 'text-sm font-semibold' : 'text-[13px] font-medium'}`}>
                    {s.name}
                  </span>
                </span>
                {isCurrent ? (
                  <span className="rounded-full bg-slate-900 text-white text-[10px] px-2 py-0.5 shrink-0">
                    Current
                  </span>
                ) : (
                  <button
                    onClick={() => onMoveTo(s.key)}
                    className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink shrink-0"
                  >
                    Move here <MoveRight size={12} />
                  </button>
                )}
              </div>

              {isCurrent && tasks.length > 0 && (
                <div className="mt-2.5 space-y-1.5">
                  {tasks.map((t) => {
                    const done = t.status === 'done';
                    return (
                      <button
                        key={t.id}
                        onClick={() => onToggleTask(t)}
                        disabled={busy}
                        className="w-full flex items-center gap-2 rounded-lg bg-slate-50 ring-1 ring-black/5 px-3 py-1.5 text-left text-xs hover:bg-slate-100 disabled:opacity-60"
                      >
                        {done ? (
                          <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                        ) : (
                          <Circle size={14} className="text-ink-muted shrink-0" />
                        )}
                        <span className={done ? 'line-through text-ink-muted' : ''}>{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {notes.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {notes.map((n) => {
                    const author = one(n.author);
                    return (
                      <div key={n.id} className="rounded-lg bg-amber-50/70 px-3 py-1.5 text-xs">
                        <p className="text-ink">{n.body}</p>
                        <p className="mt-0.5 text-[10px] text-ink-muted">
                          {author?.full_name ?? author?.email ?? 'Someone'} ·{' '}
                          {new Date(n.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}

              <NoteComposer busy={busy} onSubmit={(body) => onAddNote(s.key, body)} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NoteComposer({ busy, onSubmit }: { busy: boolean; onSubmit: (body: string) => void }) {
  const [v, setV] = useState('');
  function submit() {
    const body = v.trim();
    if (!body) return;
    setV('');
    onSubmit(body);
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
        placeholder="Add a note…"
        className="flex-1 rounded-lg bg-slate-50 ring-1 ring-black/5 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
      />
      {v.trim() && (
        <button onClick={submit} disabled={busy} className="text-ink-subtle hover:text-ink disabled:opacity-50">
          <Send size={14} />
        </button>
      )}
    </div>
  );
}

export function RunModal({
  runId,
  onClose,
  initialTargetKey,
}: {
  runId: string;
  onClose: () => void;
  /** When set (e.g. after a board drag-and-drop), immediately open the
   *  confirm-move popup for this step once the run detail has loaded. */
  initialTargetKey?: string | null;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [picking, setPicking] = useState(false);
  const [view, setView] = useState<'list' | 'flow'>('list');
  // A pending move is either a forward (gated) transition or a manual move to
  // any step (revert / sideways).
  const [confirmT, setConfirmT] = useState<Transition | null>(null);
  const [manualTarget, setManualTarget] = useState<{ key: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [override, setOverride] = useState('');

  const refetch = useCallback(async () => {
    const res = await getRunDetail(runId);
    if (res.error) setLoadError(res.error);
    else setDetail(res.data as Detail);
  }, [runId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Board drag-and-drop entry: once the detail is in, fire the pending move.
  const firedInitial = useRef(false);
  useEffect(() => {
    if (!detail || !initialTargetKey || firedInitial.current) return;
    firedInitial.current = true;
    if (detail.run.step?.key !== initialTargetKey) onDropToken(initialTargetKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, initialTargetKey]);

  function onDropToken(targetKey: string) {
    setDragging(false);
    setPicking(false);
    setMoveError(null);
    setOverride('');
    const t = detail?.transitions.find((tr) => tr.to_step?.key === targetKey) ?? null;
    if (t) {
      setManualTarget(null);
      setConfirmT(t);
    } else {
      // No forward transition → manual move (revert / sideways).
      const step = detail?.graph.steps.find((s) => s.key === targetKey);
      if (step) {
        setConfirmT(null);
        setManualTarget({ key: step.key, name: step.name });
      }
    }
  }

  async function onToggleTask(t: Task) {
    setBusy(true);
    if (t.status === 'done') await reopenTask(t.id, runId);
    else await completeTask(t.id, runId);
    await refetch();
    // Refresh the confirm transition's gate status from the new detail.
    setBusy(false);
  }

  async function onAddNote(stepKey: string, body: string) {
    setBusy(true);
    await addRunNote(runId, stepKey, body);
    await refetch();
    setBusy(false);
  }

  async function onConfirmMove() {
    if (!confirmT) return;
    setBusy(true);
    setMoveError(null);
    const needsOverride = !currentConfirmSatisfied;
    const res = await transitionRun(runId, confirmT.id, needsOverride ? override || 'override' : null);
    setBusy(false);
    if (res.error) {
      setMoveError(res.error);
      return;
    }
    setConfirmT(null);
    await refetch();
    router.refresh();
  }

  async function onConfirmManual() {
    if (!manualTarget) return;
    setBusy(true);
    setMoveError(null);
    const res = await repositionRun(runId, manualTarget.key, override || null);
    setBusy(false);
    if (res.error) {
      setMoveError(res.error);
      return;
    }
    setManualTarget(null);
    await refetch();
    router.refresh();
  }

  const person = detail ? one(detail.run.person) : null;
  // Re-derive the live gate status for the confirm transition after task edits.
  const currentConfirmSatisfied = confirmT
    ? detail?.transitions.find((t) => t.id === confirmT.id)?.gate_satisfied ?? confirmT.gate_satisfied
    : false;
  const currentGateTasks = detail?.tasks.filter((t) => t.gate_task_id) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-base font-medium">{person ? personName(person) : 'Loading…'}</h2>
            {detail?.run.step && (
              <p className="text-xs text-ink-muted">
                Currently at <span className="font-medium">{detail.run.step.name}</span> ·{' '}
                <span className="capitalize">{detail.run.status}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {detail && (
              <div className="inline-flex rounded-lg ring-1 ring-black/5 overflow-hidden">
                <button
                  onClick={() => setView('list')}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] ${
                    view === 'list' ? 'bg-slate-100 text-ink' : 'text-ink-subtle hover:text-ink'
                  }`}
                >
                  <ListIcon size={12} /> List
                </button>
                <button
                  onClick={() => setView('flow')}
                  className={`inline-flex items-center gap-1 px-2 py-1 text-[11px] border-l border-line ${
                    view === 'flow' ? 'bg-slate-100 text-ink' : 'text-ink-subtle hover:text-ink'
                  }`}
                >
                  <Workflow size={12} /> Flow
                </button>
              </div>
            )}
            {detail && (
              <Link
                href={`/runs/${runId}`}
                className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
              >
                <ExternalLink size={13} /> Full view
              </Link>
            )}
            <button onClick={onClose} className="text-ink-muted hover:text-ink">
              <X size={18} />
            </button>
          </div>
        </div>

        {loadError && (
          <div className="px-5 py-4 text-sm text-red-700 bg-red-50">{loadError}</div>
        )}

        {detail && view === 'list' && (
          <JourneyList
            detail={detail}
            busy={busy}
            onMoveTo={onDropToken}
            onToggleTask={onToggleTask}
            onAddNote={onAddNote}
          />
        )}

        {detail && view === 'flow' && (
          <>
            <div className="px-2 pt-2 text-[11px] text-ink-muted text-center">
              {picking ? (
                <span className="text-amber-700 font-medium">
                  Now click a step to move {initials(person)} there — amber = forward (gated), grey = manual move
                  / revert. Click the current step again to cancel.
                </span>
              ) : (
                <>
                  Click the <span className="font-medium">{detail.run.step?.name}</span> card to pick up{' '}
                  {initials(person)}, then click any step — forward to advance, or back to revert.
                </>
              )}
            </div>
            <ReactFlowProvider>
              <Graph
                detail={detail}
                dragging={dragging}
                setDragging={setDragging}
                picking={picking}
                setPicking={setPicking}
                onDropToken={onDropToken}
              />
            </ReactFlowProvider>
          </>
        )}

        {!detail && !loadError && (
          <div className="h-[380px] flex items-center justify-center text-sm text-ink-muted">Loading flow…</div>
        )}
      </div>

      {/* confirm-move sub-popup */}
      {confirmT && detail && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-base font-medium">
                Move to {confirmT.to_step?.name}?
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">{confirmT.label}</p>
            </div>
            <div className="px-5 py-4 space-y-3">
              {currentConfirmSatisfied ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 size={16} /> Gate satisfied — ready to move.
                </div>
              ) : (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <span>Gate not satisfied. Complete the required tasks below, or move anyway with a reason.</span>
                </div>
              )}

              {currentGateTasks.length > 0 && (
                <div className="space-y-1.5">
                  {currentGateTasks.map((t) => {
                    const done = t.status === 'done';
                    return (
                      <button
                        key={t.id}
                        onClick={() => onToggleTask(t)}
                        disabled={busy}
                        className="w-full flex items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm hover:border-line-strong disabled:opacity-60"
                      >
                        {done ? (
                          <CheckCircle2 size={17} className="text-emerald-600 shrink-0" />
                        ) : (
                          <Circle size={17} className="text-ink-muted shrink-0" />
                        )}
                        <span className={done ? 'line-through text-ink-muted' : ''}>{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {!currentConfirmSatisfied && (
                <input
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                  placeholder="Override reason (if moving anyway)"
                  className="w-full rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                />
              )}

              {moveError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {moveError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
              <button
                onClick={() => setConfirmT(null)}
                className="rounded-md px-4 py-2 text-sm text-ink-subtle hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmMove}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
              >
                {currentConfirmSatisfied ? 'Confirm move' : 'Move anyway'} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* manual move (revert / sideways) sub-popup — no gate */}
      {manualTarget &&
        detail &&
        (() => {
          const depths = stepDepths(detail.graph.steps, detail.graph.transitions);
          const curKey = detail.run.step?.key ?? '';
          const isBackward = (depths.get(manualTarget.key) ?? 0) < (depths.get(curKey) ?? 0);
          return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-line px-5 py-3.5">
              <h3 className="text-base font-medium">
                {isBackward ? 'Revert to' : 'Move to'} {manualTarget.name}?
              </h3>
              <p className="text-xs text-ink-muted mt-0.5">
                {isBackward ? 'Revert' : 'Manual move'} from {detail.run.step?.name} — no transition gate.
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-ink-subtle">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  This skips gate checks and re-creates the destination step&apos;s tasks. The move is logged on
                  the activity timeline as manual.
                </span>
              </div>
              <input
                value={override}
                onChange={(e) => setOverride(e.target.value)}
                placeholder="Reason (optional)"
                className="w-full rounded-md border border-line px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
              />
              {moveError && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {moveError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">
              <button
                onClick={() => setManualTarget(null)}
                className="rounded-md px-4 py-2 text-sm text-ink-subtle hover:text-ink"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmManual}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 text-white px-4 py-2 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
              >
                {isBackward ? (
                  <>
                    <ArrowLeft size={14} /> Revert
                  </>
                ) : (
                  <>
                    Move <ArrowRight size={14} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
          );
        })()}
    </div>
  );
}
