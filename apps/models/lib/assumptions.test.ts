import { describe, expect, it } from 'vitest';
import { defaultState, mergeState, type ModelDefinition } from './engine';
import { assumptionsText, buildAssumptions, statedList, type Words } from './assumptions';

// The words are not under test: a key and its variables are enough to see
// which sentence was chosen and what went into it.
const T: Words = (key, vars) => `${key}${vars ? ' ' + JSON.stringify(vars) : ''}`;

const def: ModelDefinition = {
  name: 'OSC', currency: 'EUR', currencySymbol: '€', unitLabel: 'members', horizon: 36,
  assumptions: ['Practices report their turnover honestly', { id: 'a2', text: 'Licences are paid in January' }],
  settings: [{ id: 'fee', label: 'Payment fee', unit: '%', value: 2, step: 0.1 }],
  genericVariable: [{ id: 'fee', label: 'Payment processing', kind: 'percentRevenue' }],
  tables: [{ id: 'lic', label: 'Licence bands', unit: 'EUR / year', mode: 'step', bands: [{ upTo: 100000, value: 3000 }, { upTo: null, value: 6000 }] }],
  reserve: { share: 10, targetMonths: 12, start: 0 },
  generators: [
    { id: 'fellows', name: 'Fellows', segment: 'Facilitators in training', inputs: [{ id: 'start', label: 'In month one', unit: 'members', value: 10, step: 1 }, { id: 'growth', label: 'Growth', unit: '%', value: 5, step: 1 }, { id: 'churn', label: 'Churn', unit: '%', value: 1, step: 1 }, { id: 'price', label: 'Fee', unit: 'EUR', value: 40, step: 5 }, { id: 'turn', label: 'Turnover', unit: 'EUR / year', value: 120000, step: 1000 }],
      volume: { start: 'start', growth: 'growth', churn: 'churn' }, revenuePerUnit: 'price', billing: { every: 12, month: 1 },
      costs: [{ id: 'care', label: 'Care', unit: 'EUR', kind: 'perUnit', value: 3, step: 1 }, { id: 'licence', label: 'Licence', kind: 'formula', formula: 'lookup(lic, turn) / 12', value: 0, step: 1 }] },
    { id: 'grant', name: 'Grant', countsAsUnit: false, inputs: [{ id: 'amount', label: 'Amount', value: 1000, step: 100 }, { id: 'from', label: 'From', value: 3, step: 1 }], volume: { start: 1, startMonth: 'from' }, revenueTotal: 'amount' },
  ],
  transitions: [],
  fixedCosts: [{ id: 'google', label: 'Google accounts', value: 17, step: 1, per: { of: 'fellows', every: 1 }, steps: [{ fromMonth: 13, value: 20 }] }],
  investment: [{ id: 'setup', label: 'Setup', value: 5000, step: 500 }],
};

describe('the assumptions list', () => {
  it('names every group the calculation rests on, segments before other streams', () => {
    const groups = buildAssumptions(def, defaultState(def), { horizon: 36, refMonth: 12 }, T);
    expect(groups.map((g) => g.id)).toEqual(['general', 'gen:fellows', 'gen:grant', 'resources', 'settings', 'tables']);
  });

  it('says how a segment grows with the numbers filled in, and what it bills', () => {
    const fellows = buildAssumptions(def, defaultState(def), { horizon: 36, refMonth: 12 }, T).find((g) => g.id === 'gen:fellows')!;
    const row = (id: string) => fellows.rows.find((r) => r.id === id)!;
    expect(row('volume').value).toBe('asm_volume {"s":"10","g":"5","c":"1","units":"members"}');
    expect(row('price').value).toBe('price');
    expect(row('price').note).toBe('= 40');
    expect(row('billing').value).toBe('calc_billing {"n":12,"m":1}');
    expect(row('table:lic').value).toBe('rel_uses_table {"n":"Licence bands"}');
    expect(row('cost:licence').value).toBe('lookup(lic, turn) / 12');
    expect(row('cost:care').note).toBe('kind_per_unit');
  });

  it('shows the default next to a number the team changed, and the months typed by hand', () => {
    const st = mergeState(defaultState(def), { generators: { fellows: { price: 45 } }, fixed: { google: 18 }, periods: { fellows: { '2': 5, '4': 9 } } });
    const groups = buildAssumptions(def, st, { horizon: 24, refMonth: 12 }, T);
    const fellows = groups.find((g) => g.id === 'gen:fellows')!;
    expect(fellows.rows.find((r) => r.id === 'in:price')).toMatchObject({ value: '45 EUR', was: 'asm_default {"v":"40 EUR"}' });
    expect(fellows.rows.find((r) => r.id === 'in:start')!.was).toBeUndefined();
    expect(fellows.rows.find((r) => r.id === 'typed')!.value).toContain('"n":"2, 4"');
    expect(groups.find((g) => g.id === 'general')!.rows.find((r) => r.id === 'horizon')!.was).toBe('asm_default {"v":"36"}');
    const google = groups.find((g) => g.id === 'resources')!.rows.find((r) => r.id === 'fixed:google')!;
    expect(google.was).toBe('asm_default {"v":"17 EUR"}');
    expect(google.note).toContain('asm_per {"e":1,"n":"Fellows"}');
    expect(google.note).toContain('rel_step {"m":13,"v":"20 EUR"}');
  });

  it('reads a lump stream, the reserve rule, the generic cost and the bands of a table', () => {
    const groups = buildAssumptions(def, defaultState(def), { horizon: 36, refMonth: 12 }, T);
    expect(groups.find((g) => g.id === 'gen:grant')!.rows.find((r) => r.id === 'volume')!.value).toBe('asm_lump {"n":"3"}');
    expect(groups.find((g) => g.id === 'general')!.rows.find((r) => r.id === 'reserve')!.value).toBe('asm_reserve_rule {"s":"10","n":12,"v":"0 EUR"}');
    expect(groups.find((g) => g.id === 'settings')!.rows[0]!.note).toBe('Payment processing: kind_percent_revenue, asm_on_all');
    const lic = groups.find((g) => g.id === 'tables')!.rows[0]!;
    expect(lic.value).toBe('asm_band_up_to {"a":"100,000","v":"3,000"} · asm_band_above {"v":"6,000"}');
    expect(lic.note).toContain('rel_used_by {"n":"Fellows"}');
  });

  it('keeps the stated assumptions, strings or objects, and writes the whole list as text', () => {
    expect(statedList(def).map((a) => a.text)).toEqual(['Practices report their turnover honestly', 'Licences are paid in January']);
    const text = assumptionsText('OSC: assumptions', 'Stated', statedList(def), buildAssumptions(def, defaultState(def), { horizon: 36, refMonth: 12 }, T));
    expect(text.startsWith('OSC: assumptions\n\nStated\n- Practices report their turnover honestly\n')).toBe(true);
    expect(text).toContain('Fellows (Facilitators in training)');
    expect(text).toContain('- Google accounts: 17 EUR / unit_month');
  });
});
