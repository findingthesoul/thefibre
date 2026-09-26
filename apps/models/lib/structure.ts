// Editing the structure of a definition in the app: segments, streams, cost
// lines, fixed costs, investment, settings. Pure functions over the
// definition; the editors call them and the page saves the result.

import { compile, type CostLine, type Generator, type ModelDefinition, type NumberInput } from './engine';

export const slugId = (label: string, taken: Iterable<string>, fallback = 'item'): string => {
  const base = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) || fallback;
  const set = new Set(taken);
  let id = base;
  for (let n = 2; set.has(id); n++) id = `${base}${n}`;
  return id;
};

export const isSegment = (g: Generator) => g.countsAsUnit !== false && !g.volume?.linkedTo;
export const segments = (def: ModelDefinition) => def.generators.filter(isSegment);

/** A formula is fine when it compiles and reads only known ids. */
export function formulaProblem(expr: string, known: Iterable<string>): string | null {
  if (!expr.trim()) return 'empty';
  try { compile(expr); } catch { return 'characters'; }
  const ids = new Set([...known, 'month', 'units', 'newUnits', 'revenue', 'batches']);
  const unknown = (expr.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []).filter((w) => !ids.has(w));
  return unknown.length ? unknown.join(', ') : null;
}

export function newSegment(def: ModelDefinition, name: string): Generator {
  const id = slugId(name, def.generators.map((g) => g.id), 'segment');
  const unit = def.unitLabel ?? 'units';
  return {
    id, name, short: name, segment: '', help: '',
    inputs: [
      { id: 'fee', label: 'Monthly fee', unit: `${def.currency ?? ''} / ${unit.replace(/s$/, '')}`, value: 0, step: 5 },
      { id: 'start', label: `${unit[0]?.toUpperCase() ?? ''}${unit.slice(1)} in month one`, unit, value: 10, step: 1 },
      { id: 'growth', label: 'Monthly growth', unit: '%', value: 5, step: 0.5 },
      { id: 'churn', label: 'Monthly churn', unit: '%', value: 2, step: 0.5 },
    ],
    volume: { start: 'start', growth: 'growth', churn: 'churn' },
    revenuePerUnit: 'fee',
    costs: [],
  };
}

export function newStream(def: ModelDefinition, name: string, linkedTo: string | null): Generator {
  const id = slugId(name, def.generators.map((g) => g.id), 'stream');
  return linkedTo
    ? { id, name, short: name, help: '', volume: { linkedTo, factor: 1 }, inputs: [{ id: 'price', label: 'Price', unit: `${def.currency ?? ''} / month`, value: 10, step: 1 }], revenuePerUnit: 'price', costs: [] }
    : { id, name, short: name, help: '', countsAsUnit: false, volume: { start: 1, startMonth: 'from' }, inputs: [{ id: 'amount', label: 'Amount', unit: `${def.currency ?? ''} / month`, value: 1000, step: 100 }, { id: 'from', label: 'Starts in month', unit: 'month', value: 1, step: 1 }], revenueTotal: 'amount', costs: [] };
}

export const newInput = (taken: Iterable<string>, label = 'New variable'): NumberInput => ({ id: slugId(label, taken, 'v'), label, unit: '', value: 0, step: 1 });
export const newCost = (taken: Iterable<string>, label = 'New cost line'): CostLine => ({ id: slugId(label, taken, 'c'), label, unit: '', kind: 'perUnit', value: 0, step: 1 });

export function upsertGenerator(def: ModelDefinition, g: Generator): ModelDefinition {
  const i = def.generators.findIndex((x) => x.id === g.id);
  const generators = i === -1 ? [...def.generators, g] : def.generators.map((x, j) => (j === i ? g : x));
  return { ...def, generators };
}

/** Streams that draw their volume from this generator; they block its deletion. */
export const dependents = (def: ModelDefinition, id: string) => def.generators.filter((g) => g.volume?.linkedTo === id);

export function removeGenerator(def: ModelDefinition, id: string): ModelDefinition {
  const canvas = { ...(def.canvas ?? {}) };
  if (canvas.valuePropositions) canvas.valuePropositions = canvas.valuePropositions.map((it) => (typeof it === 'string' ? it : { ...it, segments: (it.segments ?? []).filter((s) => s !== id) }));
  (Object.keys(canvas) as (keyof typeof canvas)[]).forEach((k) => { canvas[k] = (canvas[k] ?? []).map((it) => (typeof it === 'string' ? it : { ...it, links: (it.links ?? []).filter((l) => l !== `gen:${id}` && !l.startsWith(`cost:${id}.`)) })); });
  return { ...def, canvas, generators: def.generators.filter((g) => g.id !== id), transitions: (def.transitions ?? []).filter((tr) => tr.from !== id && tr.to !== id) };
}

export const newTransition = (def: ModelDefinition, from: string, to: string) => ({ id: slugId(`${from}_to_${to}`, (def.transitions ?? []).map((t) => t.id), 'flow'), from, to, rate: 2, move: true });
