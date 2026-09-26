import { describe, expect, it } from 'vitest';
import { defaultState, summarize, typedForMonth, fixedAmount, type ModelDefinition } from './engine';
import { DOAB } from './templates/doab';

const r = (n: number) => Math.round(n);

describe('the engine', () => {
  it('reproduces the static build\'s doáb figures without the funnel', () => {
    const def: ModelDefinition = { ...DOAB, transitions: [] };
    const s = summarize(def, defaultState(def));
    expect(r(s.breakEvenUnits ?? -1)).toBe(281);
    expect(s.breakEvenMonth).toBe(6);
    expect(s.cashPositiveMonth).toBe(17);
    expect(r(s.fundingNeed)).toBe(46325);
    expect(s.years.map((y) => [y.year, r(y.revenue), r(y.net)])).toEqual([[1, 186206, 130], [2, 358997, 100215], [3, 695107, 268707]]);
  });

  const two: ModelDefinition = {
    name: 't', generators: [
      { id: 'a', name: 'A', inputs: [{ id: 'start', label: 's', value: 100, step: 1 }], volume: { start: 'start' }, revenuePerUnit: 0 },
      { id: 'b', name: 'B', inputs: [{ id: 'start', label: 's', value: 0, step: 1 }, { id: 'fee', label: 'f', value: 10, step: 1 }], volume: { start: 'start' }, revenuePerUnit: 'fee' },
    ], horizon: 3,
  };

  it('moves a share of last month\'s people from one segment to another', () => {
    const def = { ...two, transitions: [{ id: 'ab', from: 'a', to: 'b', rate: 10 }] };
    const s = summarize(def, defaultState(def), { refMonth: 2 });
    const m1 = s.months[0]!, m2 = s.months[1]!, m3 = s.months[2]!;
    expect(m1.gens.a!.units).toBe(100); expect(m1.gens.b!.units).toBe(0);
    expect(m2.gens.a!.units).toBe(90); expect(m2.gens.b!.units).toBe(10); expect(m2.gens.b!.inflow).toBe(10); expect(m2.gens.a!.outflow).toBe(10);
    expect(m3.gens.a!.units).toBe(81); expect(m3.gens.b!.units).toBe(19);
    expect(m2.gens.b!.revenue).toBe(100);
    expect(m2.units).toBe(100);
  });

  it('can count them in both when move is false', () => {
    const def = { ...two, transitions: [{ id: 'ab', from: 'a', to: 'b', rate: 10, move: false }] };
    const s = summarize(def, defaultState(def));
    expect(s.months[1]!.gens.a!.units).toBe(100);
    expect(s.months[1]!.gens.b!.units).toBe(10);
  });

  it('reads the rate from the state, so the drawer can turn it', () => {
    const def = { ...two, transitions: [{ id: 'ab', from: 'a', to: 'b', rate: 10 }] };
    const st = defaultState(def);
    st.transitions.ab = 50;
    expect(summarize(def, st).months[1]!.gens.b!.units).toBe(50);
  });

  it('typed new clients replace growth for that month, churn still applies, and interpolate between typed months', () => {
    const def: ModelDefinition = { name: 't', horizon: 6, generators: [{ id: 'a', name: 'A', inputs: [{ id: 'start', label: 's', value: 100, step: 1 }, { id: 'growth', label: 'g', value: 10, step: 1 }, { id: 'churn', label: 'c', value: 0, step: 1 }], volume: { start: 'start', growth: 'growth', churn: 'churn' } }] };
    const st = defaultState(def);
    st.periods.a = { '2': 5, '4': 15 };
    const u = summarize(def, st).months.map((m) => m.gens.a!.units);
    expect(u[0]).toBe(100);           // month 1: start
    expect(u[1]).toBe(105);           // typed: +5
    expect(u[2]).toBe(115);           // interpolated: +10
    expect(u[3]).toBe(130);           // typed: +15
    expect(u[4]).toBeCloseTo(143, 5); // after the last typed month the formula rules: ×1.1
    expect(typedForMonth({ '2': 5, '4': 15 }, 3)).toBe(10);
    expect(typedForMonth({ '2': 5 }, 3)).toBeNull();
  });

  it('a fixed cost steps by month and grows with a segment', () => {
    const f = { id: 'fac', label: 'Facilitators', value: 3000, step: 100, steps: [{ fromMonth: 13, value: 6000 }], per: { of: 'forge', every: 40 } };
    expect(fixedAmount(f, 3000, 1, 0, { forge: 10 })).toBe(3000);
    expect(fixedAmount(f, 3000, 1, 0, { forge: 41 })).toBe(6000);
    expect(fixedAmount(f, 3000, 13, 0, { forge: 10 })).toBe(6000);
    expect(fixedAmount({ ...f, per: undefined }, 3000, 20, 0, {})).toBe(6000);
    expect(fixedAmount({ id: 'x', label: 'x', value: 1, step: 1, per: { of: 'units', every: 100 } }, 500, 1, 250, {})).toBe(1500);
  });
});
