import { describe, expect, it } from 'vitest';
import { checkRefs, type WorkspaceOf } from './workspace-refs.js';

// A tiny world: two workspaces, a person in each.
const ROWS: Record<string, { table: string; workspace: string }> = {
  pA: { table: 'person', workspace: 'wsA' },
  pB: { table: 'person', workspace: 'wsB' },
  oA: { table: 'organisation', workspace: 'wsA' },
  rB: { table: 'flow_run', workspace: 'wsB' },
};
const lookup: WorkspaceOf = async (table, id) =>
  ROWS[id] && ROWS[id]!.table === table ? ROWS[id]!.workspace : null;

const none = { person_id: null, organisation_id: null, flow_run_id: null };

describe('checkRefs', () => {
  it('accepts a person in the caller\'s own workspace', async () => {
    expect(await checkRefs('wsA', { ...none, person_id: 'pA' }, lookup)).toEqual({ ok: true });
  });

  it('refuses a person who lives in ANOTHER workspace', async () => {
    // The bug: PUT /notes filed this under wsA pointing at wsB's person.
    expect(await checkRefs('wsA', { ...none, person_id: 'pB' }, lookup)).toEqual({
      ok: false,
      field: 'person_id',
    });
  });

  it('refuses an id that does not exist', async () => {
    expect(await checkRefs('wsA', { ...none, person_id: 'nobody' }, lookup)).toMatchObject({
      ok: false,
    });
  });

  it('gives the same answer for "missing" and "elsewhere"', async () => {
    // Distinguishing them would confirm that an id exists in another tenant.
    const elsewhere = await checkRefs('wsA', { ...none, person_id: 'pB' }, lookup);
    const missing = await checkRefs('wsA', { ...none, person_id: 'nobody' }, lookup);
    expect(elsewhere).toEqual(missing);
  });

  it('checks organisations and flow runs too, not only people', async () => {
    expect(await checkRefs('wsA', { ...none, organisation_id: 'oA' }, lookup)).toEqual({ ok: true });
    expect(await checkRefs('wsA', { ...none, flow_run_id: 'rB' }, lookup)).toMatchObject({
      ok: false,
      field: 'flow_run_id',
    });
  });

  it('refuses when ANY named ref is foreign, even if another is fine', async () => {
    expect(
      await checkRefs('wsA', { person_id: 'pA', organisation_id: null, flow_run_id: 'rB' }, lookup),
    ).toMatchObject({ ok: false, field: 'flow_run_id' });
  });

  it('does not confuse tables — a person id is not accepted as an organisation', async () => {
    expect(await checkRefs('wsA', { ...none, organisation_id: 'pA' }, lookup)).toMatchObject({
      ok: false,
    });
  });

  it('allows a request that names nothing (the route rejects that separately)', async () => {
    expect(await checkRefs('wsA', none, lookup)).toEqual({ ok: true });
  });
});
