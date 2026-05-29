'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { X, GripVertical, CheckCircle2, Circle, AlertCircle, ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { getRunDetail, transitionRun, completeTask } from '../actions';

type Kind = 'entry' | 'normal' | 'end_positive' | 'end_negative';
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
  transitions: Transition[];
  graph: { steps: GraphStep[]; transitions: GraphTransition[] };
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

const KIND_STYLE: Record<string, { bg: string; border: string }> = {
  entry: { bg: 'bg-blue-50', border: 'border-blue-300' },
  normal: { bg: 'bg-white', border: 'border-neutral-300' },
  end_positive: { bg: 'bg-emerald-50', border: 'border-emerald-300' },
  end_negative: { bg: 'bg-red-50', border: 'border-red-300' },
};

type RunNodeData = {
  label: string;
  kind: string;
  isCurrent: boolean;
  isTarget: boolean;
  dragging: boolean;
  picking: boolean;
  token: string | null;
  onTokenDragStart: () => void;
  onTokenDragEnd: () => void;
  onPickToggle: () => void;
  onDropToken: (key: string) => void;
  stepKey: string;
};

function RunStepNode({ data }: NodeProps) {
  const d = data as RunNodeData;
  const style = KIND_STYLE[d.kind] ?? KIND_STYLE.normal;
  // A step is an active drop/click target while the user is dragging OR has
  // "picked up" the token (click-to-move — robust where HTML5 DnD isn't).
  const active = (d.dragging || d.picking) && d.isTarget;
  return (
    <div
      onDragOver={(e) => {
        if (d.isTarget) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (d.isTarget) d.onDropToken(d.stepKey);
      }}
      onClick={() => {
        if (active) d.onDropToken(d.stepKey);
      }}
      className={`rounded-lg border-2 ${style.bg} ${
        d.isCurrent ? 'border-neutral-800 ring-2 ring-neutral-300' : style.border
      } ${active ? 'border-dashed border-amber-500 ring-2 ring-amber-300 cursor-pointer' : ''} shadow-sm`}
      style={{ width: 176 }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="px-3 py-2.5 min-h-[52px] flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium leading-tight">{d.label}</span>
        {d.token && (
          <span
            draggable
            onDragStart={d.onTokenDragStart}
            onDragEnd={d.onTokenDragEnd}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              d.onPickToggle();
            }}
            title="Click to pick up, then click a highlighted step — or drag"
            className={`inline-flex items-center gap-1 rounded-full text-[11px] font-medium pl-1.5 pr-2 py-1 cursor-grab active:cursor-grabbing shrink-0 ${
              d.picking ? 'bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse' : 'bg-neutral-900 text-white'
            }`}
          >
            <GripVertical size={11} />
            {d.token}
          </span>
        )}
        {active && <ArrowRight size={14} className="text-amber-600 shrink-0" />}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
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
      onPickToggle: () => setPicking(!picking),
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

  return (
    <div style={{ height: 380 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#eceff2" />
      </ReactFlow>
    </div>
  );
}

export function RunModal({ runId, onClose }: { runId: string; onClose: () => void }) {
  const router = useRouter();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [picking, setPicking] = useState(false);
  const [confirmT, setConfirmT] = useState<Transition | null>(null);
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

  function onDropToken(targetKey: string) {
    setDragging(false);
    setPicking(false);
    const t = detail?.transitions.find((tr) => tr.to_step?.key === targetKey) ?? null;
    if (t) {
      setMoveError(null);
      setOverride('');
      setConfirmT(t);
    }
  }

  async function onToggleTask(t: Task) {
    setBusy(true);
    await completeTask(t.id, runId);
    await refetch();
    // Refresh the confirm transition's gate status from the new detail.
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

  const person = detail ? one(detail.run.person) : null;
  // Re-derive the live gate status for the confirm transition after task edits.
  const currentConfirmSatisfied = confirmT
    ? detail?.transitions.find((t) => t.id === confirmT.id)?.gate_satisfied ?? confirmT.gate_satisfied
    : false;
  const currentGateTasks = detail?.tasks.filter((t) => t.gate_task_id) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-2xl overflow-hidden">
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

        {detail && (
          <>
            {detail.run.status === 'active' ? (
              <div className="px-2 pt-2 text-[11px] text-ink-muted text-center">
                {picking ? (
                  <span className="text-amber-700 font-medium">
                    Now click a highlighted step to move {initials(person)} there.
                  </span>
                ) : (
                  <>
                    Click <span className="font-medium">{initials(person)}</span> to pick them up, then click a
                    highlighted step — or drag the token. Reachable steps light up.
                  </>
                )}
              </div>
            ) : (
              <div className="px-5 py-2 text-xs text-ink-muted text-center">
                This run is {detail.run.status} — no moves available.
              </div>
            )}
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
          <div className="w-full max-w-md rounded-lg bg-white shadow-2xl">
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
    </div>
  );
}
