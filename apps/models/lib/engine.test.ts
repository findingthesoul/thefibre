import { describe, expect, it } from 'vitest';
import { defaultState, summarize, type ModelDefinition } from './engine';
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
});
