'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Plus,
  Save,
  Rocket,
  Trash2,
  X,
  AlertCircle,
  CheckCircle2,
  Wand2,
  Settings2,
  Grid3x3,
  Magnet,
  Check,
  Maximize2,
  Minimize2,
  Play,
  Circle,
  CircleCheck,
  CircleX,
  Repeat,
} from 'lucide-react';
import { saveGraph, publishFlow } from '../actions';

// ---------------------------------------------------------------------------
// Types mirroring the graph JSON the API round-trips.
// ---------------------------------------------------------------------------
type Kind = 'entry' | 'normal' | 'end_positive' | 'end_negative' | 'loop';
type ActorType = 'personal' | 'team' | 'contact';
type GateTask = {
  title: string;
  actor_type: ActorType;
  contact_action_type?: string | null;
  required?: boolean;
};
type DefaultTask = { title: string; actor_type: ActorType };

type StepData = {
  key: string;
  name: string;
  kind: Kind;
  description?: string | null;
  expected_duration_days?: number | null;
  default_tasks: DefaultTask[];
  onRename: (id: string, name: string) => void;
};
type EdgeData = {
  label: string;
  gate_logic: 'all' | 'any';
  gate_tasks: GateTask[];
};

type InGraph = {
  steps: {
    key: string;
    name: string;
    kind: Kind;
    description?: string | null;
    expected_duration_days?: number | null;
    canvas_x?: number | null;
    canvas_y?: number | null;
  }[];
  transitions: {
    from: string;
    to: string;
    label: string;
    gate_logic: 'all' | 'any';
    gate_tasks?: GateTask[];
  }[];
  step_default_tasks?: { step: string; title: string; actor_type: ActorType }[];
};

// Clean-dashboard style: cards are white with a soft ring + shadow; the step
// kind shows as a tinted pill chip with an icon (not by colouring the card).
const KIND_STYLE: Record<
  Kind,
  { chip: string; chipBg: string; chipText: string; icon: typeof Play }
> = {
  entry: { chip: 'Start', chipBg: 'bg-indigo-50', chipText: 'text-indigo-600', icon: Play },
  normal: { chip: 'Step', chipBg: 'bg-slate-100', chipText: 'text-slate-500', icon: Circle },
  end_positive: { chip: 'End', chipBg: 'bg-emerald-50', chipText: 'text-emerald-600', icon: CircleCheck },
  end_negative: { chip: 'End', chipBg: 'bg-rose-50', chipText: 'text-rose-600', icon: CircleX },
  loop: { chip: 'Loop', chipBg: 'bg-amber-50', chipText: 'text-amber-600', icon: Repeat },
};

// ---------------------------------------------------------------------------
// Custom node: a step card with an inline-editable name + connect handles.
// ---------------------------------------------------------------------------
function StepCardNode({ id, data, selected }: NodeProps) {
  const d = data as StepData;
  const style = KIND_STYLE[d.kind] ?? KIND_STYLE.normal;
  const KindIcon = style.icon;
  return (
    <div
      className={`rounded-2xl bg-white transition-shadow ${
        selected
          ? 'ring-2 ring-indigo-300 shadow-lg'
          : 'ring-1 ring-black/5 shadow-card hover:shadow-card-hover'
      }`}
      style={{ width: 184 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-300 !w-2.5 !h-2.5" />
      <div className="px-3.5 py-3">
        <span
          className={`inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full mb-1.5 ${style.chipBg} ${style.chipText}`}
        >
          <KindIcon size={10} strokeWidth={2.25} />
          {style.chip}
        </span>
        <input
          value={d.name}
          onChange={(e) => d.onRename(id, e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="nodrag w-full bg-transparent text-[13px] font-medium leading-tight focus:outline-none"
          placeholder="Step name"
        />
        <div className="text-[10px] text-ink-muted font-mono truncate">{d.key}</div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-300 !w-2.5 !h-2.5" />
    </div>
  );
}

// Auto-layout for steps that have no saved coordinates: columns by depth.
function autoPositions(graph: InGraph): Map<string, { x: number; y: number }> {
  const pos = new Map<string, { x: number; y: number }>();
  const byKey = new Map(graph.steps.map((s) => [s.key, s]));
  const depth = new Map<string, number>();
  for (const s of graph.steps) depth.set(s.key, 0);
  for (let pass = 0; pass < graph.steps.length + 1; pass++) {
    let changed = false;
    for (const t of graph.transitions) {
      if (!byKey.has(t.from) || !byKey.has(t.to)) continue;
      const nd = (depth.get(t.from) ?? 0) + 1;
      if (nd > (depth.get(t.to) ?? 0) && nd <= graph.steps.length) {
        depth.set(t.to, nd);
        changed = true;
      }
    }
    if (!changed) break;
  }
  const colCounts = new Map<number, number>();
  for (const s of graph.steps) {
    const d = depth.get(s.key) ?? 0;
    const row = colCounts.get(d) ?? 0;
    colCounts.set(d, row + 1);
    pos.set(s.key, { x: 40 + d * 264, y: 40 + row * 120 });
  }
  return pos;
}

let keyCounter = 0;
function nextKey(existing: Set<string>): string {
  do {
    keyCounter += 1;
  } while (existing.has(`step_${keyCounter}`));
  return `step_${keyCounter}`;
}

function CanvasInner({
  flowId,
  lifecycle,
  initialGraph,
}: {
  flowId: string;
  lifecycle: string;
  initialGraph: InGraph;
}) {
  const router = useRouter();
  const rf = useReactFlow();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<{ kind: 'node' | 'edge'; id: string } | null>(null);
  // Canvas settings (Miro-like).
  const [showGrid, setShowGrid] = useState(true);
  const [snap, setSnap] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  // Esc exits fullscreen; refit the canvas when entering/leaving.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const t = setTimeout(() => rf.fitView({ duration: 200, padding: 0.15 }), 80);
    return () => {
      window.removeEventListener('keydown', onKey);
      clearTimeout(t);
    };
  }, [fullscreen, rf]);

  const renameRef = useRef<(id: string, name: string) => void>(() => {});

  // Seed default-task map by step key.
  const defaultsByStep = useMemo(() => {
    const m = new Map<string, DefaultTask[]>();
    for (const d of initialGraph.step_default_tasks ?? []) {
      m.set(d.step, [...(m.get(d.step) ?? []), { title: d.title, actor_type: d.actor_type }]);
    }
    return m;
  }, [initialGraph]);

  const positions = useMemo(() => autoPositions(initialGraph), [initialGraph]);

  const initialNodes: Node[] = useMemo(
    () =>
      initialGraph.steps.map((s) => ({
        id: s.key,
        type: 'stepCard',
        position:
          s.canvas_x != null && s.canvas_y != null
            ? { x: s.canvas_x, y: s.canvas_y }
            : positions.get(s.key) ?? { x: 40, y: 40 },
        data: {
          key: s.key,
          name: s.name,
          kind: s.kind,
          description: s.description ?? null,
          expected_duration_days: s.expected_duration_days ?? null,
          default_tasks: defaultsByStep.get(s.key) ?? [],
          onRename: (id: string, name: string) => renameRef.current(id, name),
        } as StepData,
      })),
    [initialGraph, positions, defaultsByStep],
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      initialGraph.transitions.map((t, i) => ({
        id: `e${i}`,
        source: t.from,
        target: t.to,
        label: t.label,
        data: { label: t.label, gate_logic: t.gate_logic, gate_tasks: t.gate_tasks ?? [] } as EdgeData,
      })),
    [initialGraph],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Inline rename handler (kept in a ref so node data closures stay stable).
  renameRef.current = (id: string, name: string) => {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, name } } : n)));
  };

  const onConnect = useCallback(
    (c: Connection) => {
      setEdges((es) =>
        addEdge(
          {
            ...c,
            id: `e${Date.now()}`,
            label: 'Transition',
            data: { label: 'Transition', gate_logic: 'all', gate_tasks: [] },
          },
          es,
        ),
      );
    },
    [setEdges],
  );

  function addStep() {
    const existing = new Set(nodes.map((n) => n.id));
    const key = nextKey(existing);
    const kind: Kind = nodes.length === 0 ? 'entry' : 'normal';
    setNodes((ns) => [
      ...ns,
      {
        id: key,
        type: 'stepCard',
        position: { x: 80 + (ns.length % 4) * 60, y: 80 + ns.length * 30 },
        data: {
          key,
          name: 'New step',
          kind,
          description: null,
          expected_duration_days: null,
          default_tasks: [],
          onRename: (id: string, name: string) => renameRef.current(id, name),
        } as StepData,
      },
    ]);
  }

  // Auto-arrange: lay nodes out in clean columns by longest-path depth from
  // the entry step (cycle-safe), rows stacked within each column. Then fit.
  function autoArrange() {
    const COL_W = 264;
    const ROW_H = 132;
    const ids = nodes.map((n) => n.id);
    const idSet = new Set(ids);
    const depth = new Map<string, number>();
    for (const id of ids) depth.set(id, 0);
    // Seed entry (kind === 'entry') at depth 0; relax along edges.
    for (let pass = 0; pass < ids.length + 1; pass++) {
      let changed = false;
      for (const e of edges) {
        if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
        const nd = (depth.get(e.source) ?? 0) + 1;
        if (nd > (depth.get(e.target) ?? 0) && nd <= ids.length) {
          depth.set(e.target, nd);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const rowByCol = new Map<number, number>();
    setNodes((ns) =>
      ns.map((n) => {
        const d = depth.get(n.id) ?? 0;
        const row = rowByCol.get(d) ?? 0;
        rowByCol.set(d, row + 1);
        return { ...n, position: { x: 40 + d * COL_W, y: 40 + row * ROW_H } };
      }),
    );
    setNotice(null);
    // Fit after the position update paints.
    setTimeout(() => rf.fitView({ duration: 300, padding: 0.15 }), 60);
  }

  function patchNode(id: string, patch: Partial<StepData>) {
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
  }
  function patchEdge(id: string, patch: Partial<EdgeData>) {
    setEdges((es) =>
      es.map((e) =>
        e.id === id
          ? { ...e, label: patch.label ?? e.label, data: { ...(e.data as EdgeData), ...patch } }
          : e,
      ),
    );
  }
  function deleteNode(id: string) {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    setSelected(null);
  }
  function deleteEdge(id: string) {
    setEdges((es) => es.filter((e) => e.id !== id));
    setSelected(null);
  }

  function serialise(): InGraph {
    const steps = nodes.map((n) => {
      const d = n.data as StepData;
      return {
        key: d.key,
        name: d.name,
        kind: d.kind,
        description: d.description ?? null,
        expected_duration_days: d.expected_duration_days ?? null,
        canvas_x: Math.round(n.position.x),
        canvas_y: Math.round(n.position.y),
      };
    });
    const transitions = edges.map((e) => {
      const d = e.data as EdgeData;
      return {
        from: e.source,
        to: e.target,
        label: d.label || 'Transition',
        gate_logic: d.gate_logic,
        gate_tasks: d.gate_tasks,
      };
    });
    const step_default_tasks = nodes.flatMap((n) => {
      const d = n.data as StepData;
      return d.default_tasks.map((t) => ({ step: d.key, title: t.title, actor_type: t.actor_type }));
    });
    return { steps, transitions, step_default_tasks };
  }

  async function onSave(thenPublish = false) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await saveGraph(flowId, JSON.stringify(serialise()));
    if (res.error) {
      setBusy(false);
      setError(res.error);
      return;
    }
    if (thenPublish) {
      const pub = await publishFlow(flowId);
      setBusy(false);
      if (pub.error) {
        setError(pub.error);
        return;
      }
      setNotice('Published. The flow is now active.');
    } else {
      setBusy(false);
      setNotice('Saved.');
    }
    router.refresh();
  }

  const nodeTypes = useMemo(() => ({ stepCard: StepCardNode }), []);

  const selectedNode = selected?.kind === 'node' ? nodes.find((n) => n.id === selected.id) : null;
  const selectedEdge = selected?.kind === 'edge' ? edges.find((e) => e.id === selected.id) : null;

  // Proactive publish-readiness hints (computed client-side so the user sees
  // what's missing before hitting Publish, and how to fix it).
  const entryCount = nodes.filter((n) => (n.data as StepData).kind === 'entry').length;
  const hasEnd = nodes.some((n) => {
    const k = (n.data as StepData).kind;
    return k === 'end_positive' || k === 'end_negative';
  });
  const readinessHints: string[] = [];
  if (nodes.length > 0 && entryCount === 0) readinessHints.push('Set one step’s Kind to "Entry".');
  if (nodes.length > 0 && entryCount > 1) readinessHints.push('Only one step can be the Entry — change the extras.');
  if (nodes.length > 0 && !hasEnd) readinessHints.push('Mark a step as an End (positive ✓ or negative ✗).');

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-50 bg-white flex flex-col'
          : 'rounded-2xl bg-white ring-1 ring-black/5 shadow-card overflow-hidden'
      }
    >
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <div className="flex items-center gap-2">
          <button
            onClick={addStep}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-line-strong"
          >
            <Plus size={15} strokeWidth={2} /> Add step
          </button>
          <button
            onClick={autoArrange}
            title="Tidy cards into clean columns"
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-line-strong"
          >
            <Wand2 size={15} strokeWidth={1.75} /> Auto-arrange
          </button>
          <div className="relative">
            <button
              onClick={() => setSettingsOpen((o) => !o)}
              title="Canvas settings"
              className="inline-flex items-center justify-center h-[34px] w-[34px] rounded-md border border-line bg-white hover:border-line-strong text-ink-subtle"
            >
              <Settings2 size={15} strokeWidth={1.75} />
            </button>
            {settingsOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSettingsOpen(false)} />
                <div className="absolute left-0 mt-1 w-52 rounded-lg border border-line bg-white shadow-lg py-1 z-20 text-sm">
                  <ToggleRow icon={Grid3x3} label="Grid" on={showGrid} onClick={() => setShowGrid((v) => !v)} />
                  <ToggleRow
                    icon={Magnet}
                    label="Magnetic (snap)"
                    on={snap}
                    onClick={() => setSnap((v) => !v)}
                  />
                </div>
              </>
            )}
          </div>
          <button
            onClick={() => setFullscreen((v) => !v)}
            title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
            className="inline-flex items-center justify-center h-[34px] w-[34px] rounded-md border border-line bg-white hover:border-line-strong text-ink-subtle"
          >
            {fullscreen ? <Minimize2 size={15} strokeWidth={1.75} /> : <Maximize2 size={15} strokeWidth={1.75} />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          {notice && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 size={14} /> {notice}
            </span>
          )}
          <button
            onClick={() => onSave(false)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3 py-1.5 text-sm hover:border-line-strong disabled:opacity-60"
          >
            <Save size={15} strokeWidth={1.75} /> Save
          </button>
          <button
            onClick={() => onSave(true)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md bg-neutral-900 text-white px-3 py-1.5 text-sm font-medium hover:bg-neutral-800 disabled:opacity-60"
          >
            <Rocket size={15} strokeWidth={1.75} /> {lifecycle === 'active' ? 'Save & republish' : 'Publish'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 border-b border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{error}</span>
        </div>
      )}

      {!error && readinessHints.length > 0 && (
        <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>
            To publish: {readinessHints.join(' ')}{' '}
            <span className="text-amber-700">Click a step card to open its panel and change its Kind.</span>
          </span>
        </div>
      )}

      <div
        className={`relative ${fullscreen ? 'flex-1' : ''}`}
        style={fullscreen ? undefined : { height: 'max(560px, calc(100vh - 340px))' }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          snapToGrid={snap}
          snapGrid={[24, 24]}
          onNodeClick={(_, n) => setSelected({ kind: 'node', id: n.id })}
          onEdgeClick={(_, e) => setSelected({ kind: 'edge', id: e.id })}
          onPaneClick={() => setSelected(null)}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: '#f8fafc' }}
        >
          {showGrid && (
            <Background variant={BackgroundVariant.Lines} gap={24} size={1} color="#e2e8f0" />
          )}
          <Controls showInteractive={false} />
        </ReactFlow>

        {selectedNode && (
          <StepPanel
            node={selectedNode}
            onClose={() => setSelected(null)}
            onPatch={(patch) => patchNode(selectedNode.id, patch)}
            onDelete={() => deleteNode(selectedNode.id)}
          />
        )}
        {selectedEdge && (
          <EdgePanel
            edge={selectedEdge}
            onClose={() => setSelected(null)}
            onPatch={(patch) => patchEdge(selectedEdge.id, patch)}
            onDelete={() => deleteEdge(selectedEdge.id)}
          />
        )}
      </div>

      <div className="border-t border-line px-3 py-2 text-xs text-ink-muted">
        Drag cards to arrange · drag from a card&apos;s right edge to another&apos;s left to connect ·
        click a card or arrow to edit · one <span className="font-medium">Entry</span> + at least one
        End step required to publish.
      </div>
    </div>
  );
}

// --- side panels -----------------------------------------------------------

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute top-0 right-0 h-full w-80 bg-white border-l border-line shadow-xl overflow-y-auto z-10">
      <div className="flex items-center justify-between border-b border-line px-4 py-3 sticky top-0 bg-white">
        <h3 className="text-sm font-medium">{title}</h3>
        <button onClick={onClose} className="text-ink-muted hover:text-ink">
          <X size={18} />
        </button>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  on,
  onClick,
}: {
  icon: typeof Grid3x3;
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-surface-sunken text-ink-subtle hover:text-ink"
    >
      <Icon size={15} strokeWidth={1.75} />
      <span className="flex-1">{label}</span>
      {on && <Check size={15} className="text-emerald-600" />}
    </button>
  );
}

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'normal', label: 'Normal' },
  { value: 'end_positive', label: 'End — positive ✓' },
  { value: 'end_negative', label: 'End — negative ✗' },
  { value: 'loop', label: 'Loop — back to start' },
];
const ACTOR_OPTIONS: { value: ActorType; label: string }[] = [
  { value: 'personal', label: 'You (personal)' },
  { value: 'team', label: 'Team' },
  { value: 'contact', label: 'Contact' },
];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-subtle mb-1">{label}</label>
      {children}
    </div>
  );
}
const inputCls =
  'w-full rounded-md border border-line px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

function StepPanel({
  node,
  onClose,
  onPatch,
  onDelete,
}: {
  node: Node;
  onClose: () => void;
  onPatch: (patch: Partial<StepData>) => void;
  onDelete: () => void;
}) {
  const d = node.data as StepData;
  return (
    <Drawer title="Step" onClose={onClose}>
      <Field label="Name">
        <input className={inputCls} value={d.name} onChange={(e) => onPatch({ name: e.target.value })} />
      </Field>
      <Field label="Kind">
        <select className={inputCls} value={d.kind} onChange={(e) => onPatch({ kind: e.target.value as Kind })}>
          {KIND_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea
          className={inputCls}
          rows={3}
          value={d.description ?? ''}
          onChange={(e) => onPatch({ description: e.target.value || null })}
        />
      </Field>
      <Field label="Expected duration (days)">
        <input
          type="number"
          min={1}
          className={inputCls}
          value={d.expected_duration_days ?? ''}
          onChange={(e) => onPatch({ expected_duration_days: e.target.value ? parseInt(e.target.value, 10) : null })}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-ink-subtle">Auto-created tasks on entry</label>
          <button
            className="text-xs text-ink-subtle hover:text-ink"
            onClick={() => onPatch({ default_tasks: [...d.default_tasks, { title: 'New task', actor_type: 'personal' }] })}
          >
            + add
          </button>
        </div>
        <div className="space-y-2">
          {d.default_tasks.map((t, i) => (
            <div key={i} className="rounded-md border border-line p-2 space-y-1.5">
              <input
                className={inputCls}
                value={t.title}
                onChange={(e) => {
                  const next = [...d.default_tasks];
                  next[i] = { ...t, title: e.target.value };
                  onPatch({ default_tasks: next });
                }}
              />
              <div className="flex items-center gap-2">
                <select
                  className={inputCls}
                  value={t.actor_type}
                  onChange={(e) => {
                    const next = [...d.default_tasks];
                    next[i] = { ...t, actor_type: e.target.value as ActorType };
                    onPatch({ default_tasks: next });
                  }}
                >
                  {ACTOR_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button
                  className="text-ink-muted hover:text-red-600 shrink-0"
                  onClick={() => onPatch({ default_tasks: d.default_tasks.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
      >
        <Trash2 size={15} /> Delete step
      </button>
    </Drawer>
  );
}

function EdgePanel({
  edge,
  onClose,
  onPatch,
  onDelete,
}: {
  edge: Edge;
  onClose: () => void;
  onPatch: (patch: Partial<EdgeData>) => void;
  onDelete: () => void;
}) {
  const d = edge.data as EdgeData;
  return (
    <Drawer title="Transition" onClose={onClose}>
      <datalist id="flow-contact-action-types">
        <option value="meeting_booked">Booked a Fibre Meet</option>
        <option value="meeting_requested">Requested a Meet (needs approval)</option>
        <option value="meeting_attended">Attended a Meet</option>
        <option value="thread.enrolment.attended">Attended a Thread session</option>
        <option value="signed_contract">Signed a contract</option>
        <option value="confirmed_attendance">Confirmed attendance</option>
        <option value="submitted_form">Submitted a form</option>
      </datalist>
      <Field label="Label">
        <input className={inputCls} value={d.label} onChange={(e) => onPatch({ label: e.target.value })} />
      </Field>
      <Field label="Gate logic">
        <select
          className={inputCls}
          value={d.gate_logic}
          onChange={(e) => onPatch({ gate_logic: e.target.value as 'all' | 'any' })}
        >
          <option value="all">All required tasks must be done</option>
          <option value="any">Any one required task is enough</option>
        </select>
      </Field>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-ink-subtle">Gate tasks (must be done to move)</label>
          <button
            className="text-xs text-ink-subtle hover:text-ink"
            onClick={() =>
              onPatch({ gate_tasks: [...d.gate_tasks, { title: 'New task', actor_type: 'personal', required: true }] })
            }
          >
            + add
          </button>
        </div>
        <div className="space-y-2">
          {d.gate_tasks.map((t, i) => (
            <div key={i} className="rounded-md border border-line p-2 space-y-1.5">
              <input
                className={inputCls}
                value={t.title}
                onChange={(e) => {
                  const next = [...d.gate_tasks];
                  next[i] = { ...t, title: e.target.value };
                  onPatch({ gate_tasks: next });
                }}
              />
              <select
                className={inputCls}
                value={t.actor_type}
                onChange={(e) => {
                  const next = [...d.gate_tasks];
                  const actor = e.target.value as ActorType;
                  next[i] = {
                    ...t,
                    actor_type: actor,
                    contact_action_type: actor === 'contact' ? t.contact_action_type ?? 'meeting_booked' : null,
                  };
                  onPatch({ gate_tasks: next });
                }}
              >
                {ACTOR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              {t.actor_type === 'contact' && (
                <>
                  <input
                    className={inputCls}
                    list="flow-contact-action-types"
                    placeholder="action type — auto-completes from activity"
                    value={t.contact_action_type ?? ''}
                    onChange={(e) => {
                      const next = [...d.gate_tasks];
                      next[i] = { ...t, contact_action_type: e.target.value || null };
                      onPatch({ gate_tasks: next });
                    }}
                  />
                  <p className="text-[11px] text-ink-muted leading-snug">
                    When an activity of this type is logged for the contact (e.g. they book a Meet), this
                    task auto-completes. Pick a known type or type your own (logged manually).
                  </p>
                </>
              )}
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                  <input
                    type="checkbox"
                    checked={t.required ?? true}
                    onChange={(e) => {
                      const next = [...d.gate_tasks];
                      next[i] = { ...t, required: e.target.checked };
                      onPatch({ gate_tasks: next });
                    }}
                  />
                  Required
                </label>
                <button
                  className="text-ink-muted hover:text-red-600"
                  onClick={() => onPatch({ gate_tasks: d.gate_tasks.filter((_, j) => j !== i) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button onClick={onDelete} className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700">
        <Trash2 size={15} /> Delete transition
      </button>
    </Drawer>
  );
}

export function FlowCanvas(props: { flowId: string; lifecycle: string; initialGraph: InGraph }) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
