'use client';

// Two charts, plain SVG. Series take their colour from the ink tokens
// (stroke-ink / stroke-ink-muted): a line chart of two series reads by weight
// and dash, never by hue, so it holds in both themes and in print.

import { useState, type MouseEvent } from 'react';
import { CARD } from '@thefibre/shared/ui/recipes';

export type Series<K extends string> = { key: K; label: string; tone: 'ink' | 'muted'; dash?: string; width?: number };
type Pt<K extends string> = Record<K, number>;

function niceTicks(min: number, max: number, n: number): number[] {
  const span = max - min || 1;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v / step) * step);
  return out;
}

const STROKE = { ink: 'stroke-ink', muted: 'stroke-ink-muted' } as const;
const FILL = { ink: 'fill-ink', muted: 'fill-ink-muted' } as const;

function Tip({ x, y, width, title, rows }: { x: number; y: number; width: number; title: string; rows: { label: string; value: string }[] }) {
  return (
    <div
      className={`${CARD} pointer-events-none absolute z-10 px-2.5 py-1.5 text-xs whitespace-nowrap shadow-card`}
      style={{ left: x > width * 0.6 ? undefined : x + 12, right: x > width * 0.6 ? width - x + 12 : undefined, top: Math.max(0, y - 30) }}
    >
      <div className="font-medium">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between gap-3.5"><span className="text-ink-subtle">{r.label}</span><span className="tabular-nums">{r.value}</span></div>
      ))}
    </div>
  );
}

export function LineChart<K extends string>({
  points, series, xLabel, xFmt, yFmt, yFmtFull, marker, markerLabel, tipTitle, height = 280,
}: {
  points: (Pt<K> & { x: number })[];
  series: Series<K>[];
  xLabel: string;
  xFmt: (v: number) => string;
  yFmt: (v: number) => string;
  yFmtFull: (v: number) => string;
  marker?: number | null;
  markerLabel?: string;
  tipTitle: (p: Pt<K> & { x: number }) => string;
  height?: number;
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number; w: number } | null>(null);
  const W = 600, H = height, padL = 56, padR = 12, padT = 14, padB = 34;
  const pw = W - padL - padR, ph = H - padT - padB;
  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs), maxX = Math.max(...xs) || 1;
  let minY = Math.min(0, ...points.flatMap((p) => series.map((s) => p[s.key] ?? 0)));
  let maxY = Math.max(...points.flatMap((p) => series.map((s) => p[s.key] ?? 0)), 1);
  const span = maxY - minY;
  maxY += span * 0.06;
  if (minY < 0) minY -= span * 0.06;
  const xAt = (v: number) => padL + ((v - minX) / (maxX - minX || 1)) * pw;
  const yAt = (v: number) => padT + ph - ((v - minY) / (maxY - minY || 1)) * ph;

  function onMove(e: MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = Infinity;
    points.forEach((p, i) => { const d = Math.abs(xAt(p.x) - fx); if (d < bd) { bd = d; best = i; } });
    setHover({ i: best, px: (xAt(points[best]!.x) / W) * r.width, py: e.clientY - r.top, w: r.width });
  }
  const hp = hover ? points[hover.i] : null;

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-full overflow-visible" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {niceTicks(minY, maxY, 5).map((tk) => (
          <g key={tk}>
            <line x1={padL} x2={W - padR} y1={yAt(tk)} y2={yAt(tk)} className="stroke-line" strokeOpacity={tk === 0 ? 1 : 0.6} vectorEffect="non-scaling-stroke" />
            <text x={padL - 8} y={yAt(tk) + 3.5} textAnchor="end" fontSize="10.5" className="fill-ink-muted">{yFmt(tk)}</text>
          </g>
        ))}
        {niceTicks(minX, maxX, 6).filter((v) => v >= minX && v <= maxX).map((tk) => (
          <text key={tk} x={xAt(tk)} y={H - padB + 16} textAnchor="middle" fontSize="10.5" className="fill-ink-muted">{xFmt(tk)}</text>
        ))}
        <text x={padL + pw / 2} y={H - 4} textAnchor="middle" fontSize="10.5" className="fill-ink-muted">{xLabel}</text>
        {marker != null && marker >= minX && marker <= maxX && (
          <g>
            <line x1={xAt(marker)} x2={xAt(marker)} y1={padT} y2={padT + ph} className="stroke-ink-muted" strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
            <text x={xAt(marker) + (xAt(marker) > W - 90 ? -6 : 6)} y={padT + 10} textAnchor={xAt(marker) > W - 90 ? 'end' : 'start'} fontSize="10.5" className="fill-ink">{markerLabel}</text>
          </g>
        )}
        {series.map((s) => (
          <path key={s.key} d={points.map((p, i) => `${i ? 'L' : 'M'}${xAt(p.x).toFixed(1)},${yAt(p[s.key] ?? 0).toFixed(1)}`).join(' ')} fill="none" className={STROKE[s.tone]} strokeWidth={s.width ?? 2} strokeDasharray={s.dash} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        ))}
        {hp && (
          <g>
            <line x1={xAt(hp.x)} x2={xAt(hp.x)} y1={padT} y2={padT + ph} className="stroke-ink-muted" vectorEffect="non-scaling-stroke" />
            {series.map((s) => <circle key={s.key} cx={xAt(hp.x)} cy={yAt(hp[s.key] ?? 0)} r={4} className={`${FILL[s.tone]} stroke-surface-raised`} strokeWidth={2} />)}
          </g>
        )}
      </svg>
      {hover && hp && <Tip x={hover.px} y={hover.py} width={hover.w} title={tipTitle(hp)} rows={series.map((s) => ({ label: s.label, value: yFmtFull(hp[s.key] ?? 0) }))} />}
    </div>
  );
}

export function BarChart<K extends string>({
  groups, series, yFmt, yFmtFull, netFmt, netLabel, height = 240,
}: {
  groups: (Pt<K> & { label: string; net: number })[];
  series: Series<K>[];
  yFmt: (v: number) => string;
  yFmtFull: (v: number) => string;
  netFmt: (v: number) => string;
  netLabel: string;
  height?: number;
}) {
  const [hover, setHover] = useState<{ i: number; px: number; py: number; w: number } | null>(null);
  const W = 600, H = height, padL = 56, padR = 12, padT = 16, padB = 30;
  const pw = W - padL - padR, ph = H - padT - padB;
  const maxY = Math.max(1, ...groups.flatMap((g) => series.map((s) => g[s.key] ?? 0))) * 1.08;
  const yAt = (v: number) => padT + ph - (v / maxY) * ph;
  const gw = pw / Math.max(groups.length, 1), bw = Math.min(40, gw * 0.32), gap = 4;
  function onMove(e: MouseEvent<SVGSVGElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const fx = ((e.clientX - r.left) / r.width) * W;
    const i = Math.min(groups.length - 1, Math.max(0, Math.floor((fx - padL) / gw)));
    setHover({ i, px: ((padL + gw * i + gw / 2) / W) * r.width, py: e.clientY - r.top, w: r.width });
  }
  const hg = hover ? groups[hover.i] : null;
  return (
    <div className="relative" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full h-full overflow-visible" onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img">
        {niceTicks(0, maxY, 4).map((tk) => (
          <g key={tk}>
            <line x1={padL} x2={W - padR} y1={yAt(tk)} y2={yAt(tk)} className="stroke-line" strokeOpacity={tk === 0 ? 1 : 0.6} vectorEffect="non-scaling-stroke" />
            <text x={padL - 8} y={yAt(tk) + 3.5} textAnchor="end" fontSize="10.5" className="fill-ink-muted">{yFmt(tk)}</text>
          </g>
        ))}
        {groups.map((g, i) => {
          const cx = padL + gw * i + gw / 2;
          const top = yAt(Math.max(...series.map((s) => g[s.key] ?? 0)));
          return (
            <g key={g.label}>
              {series.map((s, j) => {
                const x = cx - (series.length * bw + (series.length - 1) * gap) / 2 + j * (bw + gap);
                const y = yAt(g[s.key] ?? 0);
                return <rect key={s.key} x={x} y={y} width={bw} height={padT + ph - y} rx={3} className={FILL[s.tone]} />;
              })}
              <text x={cx} y={H - padB + 16} textAnchor="middle" fontSize="10.5" className="fill-ink-muted">{g.label}</text>
              <text x={cx} y={top - 6} textAnchor="middle" fontSize="10.5" className="fill-ink">{netFmt(g.net)}</text>
            </g>
          );
        })}
      </svg>
      {hover && hg && <Tip x={hover.px} y={hover.py} width={hover.w} title={hg.label} rows={[...series.map((s) => ({ label: s.label, value: yFmtFull(hg[s.key] ?? 0) })), { label: netLabel, value: yFmtFull(hg.net) }]} />}
    </div>
  );
}
