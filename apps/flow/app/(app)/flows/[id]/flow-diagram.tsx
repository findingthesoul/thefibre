'use client';

// Read-only visual rendering of a flow graph. Auto-lays-out steps into
// columns by longest-path depth from the entry step, draws transitions as
// curved arrows with labels + gate-task counts. The first slice of the
// visual builder (Phase G) — drag-to-edit comes next; for now it makes the
// flow legible at a glance, which the JSON never did.

type Step = {
  key: string;
  name: string;
  kind: 'entry' | 'normal' | 'end_positive' | 'end_negative' | string;
};
type GateTask = { title: string; actor_type: string; required?: boolean };
type Transition = {
  from: string;
  to: string;
  label: string;
  gate_logic: string;
  gate_tasks?: GateTask[];
};
type Graph = { steps: Step[]; transitions: Transition[] };

const NODE_W = 168;
const NODE_H = 64;
const COL_GAP = 96;
const ROW_GAP = 28;
const PAD = 24;

const KIND_STYLE: Record<string, { fill: string; stroke: string; text: string; chip: string }> = {
  entry: { fill: '#eff6ff', stroke: '#bfdbfe', text: '#1e40af', chip: 'Entry' },
  normal: { fill: '#ffffff', stroke: '#e5e7eb', text: '#111827', chip: '' },
  end_positive: { fill: '#ecfdf5', stroke: '#a7f3d0', text: '#065f46', chip: '✓ End' },
  end_negative: { fill: '#fef2f2', stroke: '#fecaca', text: '#991b1b', chip: '✗ End' },
};

function layout(graph: Graph) {
  const steps = graph.steps ?? [];
  const byKey = new Map(steps.map((s) => [s.key, s]));
  const entry = steps.find((s) => s.kind === 'entry') ?? steps[0];

  // Longest-path depth via relaxation (cycle-safe: cap at |steps| passes).
  const depth = new Map<string, number>();
  for (const s of steps) depth.set(s.key, 0);
  if (entry) depth.set(entry.key, 0);
  const outgoing = new Map<string, string[]>();
  for (const t of graph.transitions ?? []) {
    if (!byKey.has(t.from) || !byKey.has(t.to)) continue;
    outgoing.set(t.from, [...(outgoing.get(t.from) ?? []), t.to]);
  }
  for (let pass = 0; pass < steps.length + 1; pass++) {
    let changed = false;
    for (const t of graph.transitions ?? []) {
      if (!byKey.has(t.from) || !byKey.has(t.to)) continue;
      const nd = (depth.get(t.from) ?? 0) + 1;
      if (nd > (depth.get(t.to) ?? 0)) {
        // Don't let back-edges (loops) inflate depth unboundedly.
        if (nd <= steps.length) {
          depth.set(t.to, nd);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // Group into columns by depth.
  const columns = new Map<number, string[]>();
  for (const s of steps) {
    const d = depth.get(s.key) ?? 0;
    columns.set(d, [...(columns.get(d) ?? []), s.key]);
  }
  const maxDepth = Math.max(0, ...[...columns.keys()]);

  const pos = new Map<string, { x: number; y: number }>();
  let maxRows = 0;
  for (let d = 0; d <= maxDepth; d++) {
    const col = columns.get(d) ?? [];
    maxRows = Math.max(maxRows, col.length);
    col.forEach((key, i) => {
      pos.set(key, {
        x: PAD + d * (NODE_W + COL_GAP),
        y: PAD + i * (NODE_H + ROW_GAP),
      });
    });
  }

  const width = PAD * 2 + (maxDepth + 1) * NODE_W + maxDepth * COL_GAP;
  const height = PAD * 2 + maxRows * NODE_H + Math.max(0, maxRows - 1) * ROW_GAP;
  return { pos, width: Math.max(width, 320), height: Math.max(height, 160), entry };
}

export function FlowDiagram({ graph }: { graph: Graph }) {
  const steps = graph.steps ?? [];
  if (steps.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-white p-8 text-center text-sm text-ink-subtle">
        No steps yet. Define the graph below, then save — the diagram appears here.
      </div>
    );
  }

  const { pos, width, height } = layout(graph);

  return (
    <div className="rounded-lg border border-line bg-white overflow-x-auto">
      <svg width={width} height={height} className="block" style={{ minWidth: '100%' }}>
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#9ca3af" />
          </marker>
        </defs>

        {/* edges */}
        {(graph.transitions ?? []).map((t, i) => {
          const a = pos.get(t.from);
          const b = pos.get(t.to);
          if (!a || !b) return null;
          const forward = b.x >= a.x;
          const x1 = a.x + NODE_W;
          const y1 = a.y + NODE_H / 2;
          const x2 = b.x;
          const y2 = b.y + NODE_H / 2;
          // For back/loop edges (target left of source), route from bottom out
          // and around to keep arrows readable.
          let d: string;
          let labelX: number;
          let labelY: number;
          if (forward) {
            const mx = (x1 + x2) / 2;
            d = `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
            labelX = mx;
            labelY = (y1 + y2) / 2 - 6;
          } else {
            const sx = a.x + NODE_W / 2;
            const sy = a.y + NODE_H;
            const tx = b.x + NODE_W / 2;
            const ty = b.y + NODE_H;
            const dip = Math.max(sy, ty) + 46;
            d = `M ${sx} ${sy} C ${sx} ${dip}, ${tx} ${dip}, ${tx} ${ty}`;
            labelX = (sx + tx) / 2;
            labelY = dip - 6;
          }
          const gateN = t.gate_tasks?.length ?? 0;
          return (
            <g key={i}>
              <path d={d} fill="none" stroke="#9ca3af" strokeWidth={1.5} markerEnd="url(#arrow)" />
              <foreignObject x={labelX - 70} y={labelY - 12} width={140} height={24}>
                <div className="flex justify-center">
                  <span className="inline-flex items-center gap-1 rounded bg-white/90 border border-line px-1.5 py-0.5 text-[10px] text-ink-subtle whitespace-nowrap">
                    {t.label}
                    {gateN > 0 && (
                      <span className="text-amber-700">
                        · {t.gate_logic === 'any' ? 'any' : 'all'} {gateN}
                      </span>
                    )}
                  </span>
                </div>
              </foreignObject>
            </g>
          );
        })}

        {/* nodes */}
        {steps.map((s) => {
          const p = pos.get(s.key);
          if (!p) return null;
          const style = KIND_STYLE[s.kind] ?? KIND_STYLE.normal;
          return (
            <g key={s.key}>
              <rect
                x={p.x}
                y={p.y}
                width={NODE_W}
                height={NODE_H}
                rx={10}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={1.5}
              />
              <foreignObject x={p.x} y={p.y} width={NODE_W} height={NODE_H}>
                <div className="h-full w-full px-3 py-2 flex flex-col justify-center">
                  {style.chip && (
                    <div
                      className="text-[9px] uppercase tracking-wider mb-0.5"
                      style={{ color: style.text, opacity: 0.7 }}
                    >
                      {style.chip}
                    </div>
                  )}
                  <div
                    className="text-[13px] font-medium leading-tight truncate"
                    style={{ color: style.text }}
                  >
                    {s.name}
                  </div>
                  <div className="text-[10px] text-ink-muted font-mono truncate">{s.key}</div>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
