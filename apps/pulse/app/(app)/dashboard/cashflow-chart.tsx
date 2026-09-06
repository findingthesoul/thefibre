'use client';

import { useMemo, useState } from 'react';
import { money, formatPeriod } from '@/lib/money';
import { t, INTL_LOCALES, type Locale, type UiKey } from '@/lib/i18n-ui';

export type Period = {
  start: string;
  end: string;
  committed_in: number;
  committed_out: number;
  expected_in: number;
  expected_out: number;
  best_in: number;
  best_out: number;
  reserved_committed: number;
  reserved_expected: number;
  balance_committed: number;
  balance_expected: number;
  balance_best: number;
};

export type Projection = {
  granularity: string;
  currency: string;
  anchor: { bank_cents: number; reserve_cents: number };
  reservation_pct: number;
  dips_below_zero: { committed: string | null; expected: string | null };
  periods: Period[];
};

type Layer = 'expected' | 'committed' | 'best';

const LAYERS: { key: Layer; labelKey: UiKey }[] = [
  { key: 'expected', labelKey: 'layer_expected' },
  { key: 'committed', labelKey: 'layer_committed' },
  { key: 'best', labelKey: 'layer_best' },
];

function flows(p: Period, layer: Layer): { in: number; out: number } {
  if (layer === 'committed') return { in: p.committed_in, out: p.committed_out };
  if (layer === 'best') return { in: p.best_in, out: p.best_out };
  return { in: p.expected_in, out: p.expected_out };
}

// Chart geometry (viewBox units — the SVG itself is fluid).
const W = 860;
const H = 280;
const PAD_TOP = 12;
const PAD_BOTTOM = 26; // room for x labels
const PAD_X = 8;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;
const PLOT_W = W - 2 * PAD_X;

export default function CashflowChart({
  projection,
  locale,
}: {
  projection: Projection;
  locale: Locale;
}) {
  const { periods, currency } = projection;
  const intl = INTL_LOCALES[locale];
  const [layer, setLayer] = useState<Layer>('expected');
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  // Shared y-scale for bars + balance lines, so the zero line is one line.
  // Include every layer's flows so toggling layers doesn't rescale the chart.
  const { min, max } = useMemo(() => {
    const values = [0];
    for (const p of periods) {
      values.push(p.balance_committed, p.balance_expected);
      values.push(p.committed_in, p.committed_out);
      values.push(p.expected_in, p.expected_out);
      values.push(p.best_in, p.best_out);
    }
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [periods]);

  if (periods.length === 0) {
    return (
      <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-8 text-center">
        <p className="text-sm text-ink-muted">{t(locale, 'no_periods_yet')}</p>
      </div>
    );
  }

  const span = max - min || 1;
  const y = (v: number) => PAD_TOP + ((max - v) * PLOT_H) / span;
  const zeroY = y(0);

  const n = periods.length;
  const colW = PLOT_W / n;
  const colX = (i: number) => PAD_X + i * colW;
  const cx = (i: number) => colX(i) + colW / 2;

  // Paired bars: money in + money out, side by side, rising from the zero line.
  const barW = Math.min(18, Math.max(3, colW * 0.3));
  const barGap = Math.min(4, barW * 0.25);

  const linePoints = (pick: (p: Period) => number) =>
    periods.map((p, i) => `${cx(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(' ');

  // Skip x labels when crowded — aim for ~12 at most.
  const labelStep = Math.max(1, Math.ceil(n / 12));

  const hovered = hover !== null ? periods[hover] : null;
  const tooltipLeftPct = hover !== null ? (cx(hover) / W) * 100 : 0;
  const tooltipFlip = tooltipLeftPct > 62;

  return (
    <div className="mt-10 rounded-2xl bg-white ring-1 ring-black/5 shadow-card p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-base font-semibold tracking-tight">{t(locale, 'chart_overview')}</h2>
        <div
          className="flex rounded-lg ring-1 ring-black/10 overflow-hidden text-xs"
          role="tablist"
          aria-label={t(locale, 'chart_bar_layer_aria')}
        >
          {LAYERS.map((l) => (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={layer === l.key}
              onClick={() => setLayer(l.key)}
              className={`px-2.5 py-1 transition ${
                layer === l.key
                  ? 'bg-ink text-white'
                  : 'bg-white text-ink-muted hover:text-ink'
              }`}
            >
              {t(locale, l.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full h-auto"
          role="img"
          aria-label={t(locale, 'chart_aria')}
          onMouseLeave={() => setHover(null)}
        >
          {/* Below-zero region — faint red so a dipping balance is instantly visible */}
          {zeroY < H - PAD_BOTTOM && (
            <rect
              x={PAD_X}
              y={zeroY}
              width={PLOT_W}
              height={H - PAD_BOTTOM - zeroY}
              fill="#ef4444"
              opacity={0.06}
            />
          )}

          {/* Hover highlight */}
          {hover !== null && (
            <rect
              x={colX(hover)}
              y={PAD_TOP}
              width={colW}
              height={PLOT_H}
              fill="#000000"
              opacity={0.04}
              rx={4}
            />
          )}

          {/* Zero line */}
          <line
            x1={PAD_X}
            x2={W - PAD_X}
            y1={zeroY}
            y2={zeroY}
            stroke="#d4d4d4"
            strokeWidth={1}
          />

          {/* Bars — in (emerald) / out (rose), per period */}
          {periods.map((p, i) => {
            const f = flows(p, layer);
            const inH = ((f.in - 0) * PLOT_H) / span;
            const outH = ((f.out - 0) * PLOT_H) / span;
            const center = cx(i);
            return (
              <g key={p.start}>
                {f.in > 0 && (
                  <rect
                    x={center - barW - barGap / 2}
                    y={zeroY - inH}
                    width={barW}
                    height={Math.max(1, inH)}
                    fill="#10b981"
                    opacity={hover === null || hover === i ? 0.9 : 0.45}
                    rx={1.5}
                  />
                )}
                {f.out > 0 && (
                  <rect
                    x={center + barGap / 2}
                    y={zeroY - outH}
                    width={barW}
                    height={Math.max(1, outH)}
                    fill="#f43f5e"
                    opacity={hover === null || hover === i ? 0.9 : 0.45}
                    rx={1.5}
                  />
                )}
              </g>
            );
          })}

          {/* Balance lines — always committed (solid) + expected (dashed) */}
          <polyline
            points={linePoints((p) => p.balance_expected)}
            fill="none"
            stroke="#6366f1"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
          <polyline
            points={linePoints((p) => p.balance_committed)}
            fill="none"
            stroke="#047857"
            strokeWidth={2.5}
          />

          {/* Hovered-period markers on the balance lines */}
          {hovered && hover !== null && (
            <g>
              <circle cx={cx(hover)} cy={y(hovered.balance_committed)} r={3.5} fill="#047857" />
              <circle cx={cx(hover)} cy={y(hovered.balance_expected)} r={3} fill="#6366f1" />
            </g>
          )}

          {/* X-axis labels — skip when crowded */}
          {periods.map((p, i) =>
            i % labelStep === 0 ? (
              <text
                key={p.start}
                x={cx(i)}
                y={H - 8}
                textAnchor="middle"
                fontSize={11}
                fill="#737373"
              >
                {formatPeriod(p.start, intl)}
              </text>
            ) : null,
          )}

          {/* Transparent hover targets, one per period column */}
          {periods.map((p, i) => (
            <rect
              key={`hit-${p.start}`}
              x={colX(i)}
              y={PAD_TOP}
              width={colW}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {/* Tooltip */}
        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 rounded-lg bg-white ring-1 ring-black/10 shadow-lg px-3 py-2 text-xs min-w-[200px]"
            style={
              tooltipFlip
                ? { right: `${(100 - tooltipLeftPct + 2).toFixed(1)}%` }
                : { left: `${(tooltipLeftPct + 2).toFixed(1)}%` }
            }
          >
            <div className="font-medium text-ink mb-1.5">
              {formatPeriod(hovered.start, intl)} – {formatPeriod(hovered.end, intl)}
            </div>
            <dl className="space-y-0.5">
              <TooltipRow
                label={t(locale, 'tt_in')}
                value={t(locale, 'tt_in_value', {
                  c: money(hovered.committed_in, currency),
                  e: money(hovered.expected_in, currency),
                })}
              />
              <TooltipRow
                label={t(locale, 'tt_out')}
                value={money(flows(hovered, layer).out, currency)}
              />
              <TooltipRow
                label={t(locale, 'reserved')}
                value={money(
                  layer === 'committed' ? hovered.reserved_committed : hovered.reserved_expected,
                  currency,
                )}
              />
              <TooltipRow
                label={t(locale, 'balance_committed')}
                value={money(hovered.balance_committed, currency)}
                negative={hovered.balance_committed < 0}
              />
              <TooltipRow
                label={t(locale, 'balance_expected')}
                value={money(hovered.balance_expected, currency)}
                negative={hovered.balance_expected < 0}
              />
            </dl>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-emerald-500" />{' '}
          {t(locale, 'legend_money_in')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-[3px] bg-rose-500" />{' '}
          {t(locale, 'legend_money_out')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-0.5 bg-emerald-700" />{' '}
          {t(locale, 'legend_balance_committed')}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-4 border-t-2 border-dashed border-indigo-500" />{' '}
          {t(locale, 'legend_balance_expected')}
        </span>
      </div>

      {/* Collapsible period table */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowTable((v) => !v)}
          className="text-xs font-medium text-ink-muted hover:text-ink underline underline-offset-2 transition"
        >
          {showTable ? t(locale, 'hide_table') : t(locale, 'show_table')}
        </button>
        {showTable && (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted border-b border-line">
                <th className="py-2 pr-4 font-medium">{t(locale, 'th_period')}</th>
                <th className="py-2 pr-4 font-medium text-right">{t(locale, 'th_in_committed')}</th>
                <th className="py-2 pr-4 font-medium text-right">{t(locale, 'tt_out')}</th>
                <th className="py-2 pr-4 font-medium text-right">{t(locale, 'th_balance')}</th>
                <th className="py-2 font-medium text-right">{t(locale, 'balance_expected')}</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.start} className="border-b border-line/50 last:border-0">
                  <td className="py-2 pr-4 text-ink-subtle">{formatPeriod(p.start, intl)}</td>
                  <td className="py-2 pr-4 text-right">{money(p.committed_in, currency)}</td>
                  <td className="py-2 pr-4 text-right">{money(p.committed_out, currency)}</td>
                  <td
                    className={`py-2 pr-4 text-right font-medium ${p.balance_committed < 0 ? 'text-red-600' : 'text-ink'}`}
                  >
                    {money(p.balance_committed, currency)}
                  </td>
                  <td
                    className={`py-2 text-right ${p.balance_expected < 0 ? 'text-red-500' : 'text-ink-subtle'}`}
                  >
                    {money(p.balance_expected, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TooltipRow({
  label,
  value,
  negative,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-ink-muted">{label}</dt>
      <dd className={`text-right tabular-nums ${negative ? 'text-red-600 font-medium' : 'text-ink'}`}>
        {value}
      </dd>
    </div>
  );
}
