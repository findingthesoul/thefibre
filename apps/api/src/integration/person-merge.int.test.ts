// Merging two people, against real Postgres.
//
// This is the riskiest code in the person-SPoT work: merge_person discovers
// every FK pointing at public.person from pg_constraint and repoints them, so
// a mistake silently moves — or loses — somebody's enrolments, payments and
// history. A unit test cannot exercise any of that, because the whole point
// is what the catalogue says and what the unique constraints do.
//
// Throwaway workspace, fixture rows cleaned by their own ids. Staging only,
// per the harness rules.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let ws: string;
let appId: string;
const madePeople: string[] = [];

async function makePerson(first: string, last: string | null, email: string | null) {
  const { data, error } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: first, last_name: last, email })
    .select('id')
    .single();
  if (error) throw new Error(`fixture person: ${error.message}`);
  madePeople.push(data!.id as string);
  return data!.id as string;
}

async function activityCount(personId: string) {
  const { count } = await service
    .from('activity')
    .select('id', { count: 'exact', head: true })
    .eq('person_id', personId);
  return count ?? 0;
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('merge');
  const { data: app } = await service.from('app').select('id').eq('slug', 'fibre-platform').single();
  appId = app!.id as string;
});

afterAll(async () => {
  if (madePeople.length) {
    await service.from('activity').delete().in('person_id', madePeople);
    await service.from('person_merge').delete().eq('workspace_id', ws);
    await service.from('person').delete().in('id', madePeople);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('merge_person', () => {
  it('leaves activity where it is — the log is append-only — and resolves it on read', async () => {
    const keep = await makePerson('Marja', 'Bakker', `marja-${Date.now()}@example.com`);
    const dupe = await makePerson('M.', 'Bakker', `m-bakker-${Date.now()}@example.com`);

    // Two activity rows on the duplicate — the thing a bad merge would lose.
    await service.from('activity').insert([
      { workspace_id: ws, person_id: dupe, app_id: appId, type: 'test', subject: 'first' },
      { workspace_id: ws, person_id: dupe, app_id: appId, type: 'test', subject: 'second' },
    ]);
    await service.from('activity').insert({
      workspace_id: ws,
      person_id: keep,
      app_id: appId,
      type: 'test',
      subject: 'already here',
    });

    expect(await activityCount(dupe)).toBe(2);
    expect(await activityCount(keep)).toBe(1);

    const { data: mergeId, error } = await service.rpc('merge_person', {
      p_keep: keep,
      p_merge: dupe,
      p_actor: null,
    });
    expect(error).toBeNull();
    expect(mergeId).toBeTruthy();

    // Activity rows do NOT move. A trigger makes the log append-only, and the
    // event really did happen against that record — repointing it would be
    // rewriting history for administrative convenience.
    expect(await activityCount(keep)).toBe(1);
    expect(await activityCount(dupe)).toBe(2);

    // They are reachable instead: the kept person expands to include everyone
    // merged into them, so their timeline still shows all three.
    const { data: expanded } = await service.rpc('person_and_merged', { p_person: keep });
    const ids = (expanded ?? []).map((x: unknown) =>
      typeof x === 'string' ? x : (x as { person_and_merged: string }).person_and_merged,
    );
    expect(ids).toContain(keep);
    expect(ids).toContain(dupe);

    const { count: visible } = await service
      .from('activity')
      .select('id', { count: 'exact', head: true })
      .in('person_id', ids);
    expect(visible).toBe(3);

    // The merged row is still there — soft-deleted and pointing forward, so
    // anything still holding its id can follow it.
    const { data: gone } = await service
      .from('person')
      .select('deleted_at, merged_into')
      .eq('id', dupe)
      .single();
    expect(gone!.deleted_at).not.toBeNull();
    expect(gone!.merged_into).toBe(keep);

    // And undo puts it back exactly.
    const { error: undoErr } = await service.rpc('unmerge_person', {
      p_merge_id: mergeId,
      p_actor: null,
    });
    expect(undoErr).toBeNull();

    const { data: back } = await service
      .from('person')
      .select('deleted_at, merged_into')
      .eq('id', dupe)
      .single();
    expect(back!.deleted_at).toBeNull();
    expect(back!.merged_into).toBeNull();
  });

  it('keeps the destination row when a unique constraint forbids two, and records the loss', async () => {
    const keep = await makePerson('Ana', 'Costa', `ana-${Date.now()}@example.com`);
    const dupe = await makePerson('Ana', 'Costa', `ana2-${Date.now()}@example.com`);

    // person_professional is unique on person_id — both cannot survive.
    // app_id is NOT NULL ("the app justifies the field"), so the fixture has
    // to name one; the assert is here because omitting it failed silently the
    // first time and looked like a merge bug.
    const { error: fixErr } = await service.from('person_professional').insert([
      { person_id: keep, current_title: 'kept', app_id: appId },
      { person_id: dupe, current_title: 'dropped', app_id: appId },
    ]);
    expect(fixErr).toBeNull();

    const { data: mergeId, error } = await service.rpc('merge_person', {
      p_keep: keep,
      p_merge: dupe,
      p_actor: null,
    });
    expect(error).toBeNull();

    // The kept person's own profile survives untouched.
    const { data: prof } = await service
      .from('person_professional')
      .select('current_title')
      .eq('person_id', keep)
      .single();
    expect(prof!.current_title).toBe('kept');

    // And the one that could not move is recorded rather than silently gone,
    // so the UI can say what a merge actually cost.
    const { data: audit } = await service
      .from('person_merge')
      .select('dropped')
      .eq('id', mergeId)
      .single();
    const dropped = (audit!.dropped as { table: string; rows: unknown[] }[]) ?? [];
    const flat = dropped.flatMap((d) => d.rows as Record<string, unknown>[]);
    expect(flat.some((r) => r.current_title === 'dropped')).toBe(true);

    await service.rpc('unmerge_person', { p_merge_id: mergeId, p_actor: null });
    // Undo restores the dropped profile row.
    const { count } = await service
      .from('person_professional')
      .select('person_id', { count: 'exact', head: true })
      .eq('person_id', dupe);
    expect(count).toBe(1);
    await service.from('person_professional').delete().in('person_id', [keep, dupe]);
  });

  it('refuses to merge across workspaces', async () => {
    const other = await createThrowawayWorkspace('merge2');
    try {
      const here = await makePerson('Local', 'Person', `local-${Date.now()}@example.com`);
      const { data: there } = await service
        .from('person')
        .insert({ workspace_id: other, first_name: 'Far', last_name: 'Person' })
        .select('id')
        .single();

      const { error } = await service.rpc('merge_person', {
        p_keep: here,
        p_merge: there!.id,
        p_actor: null,
      });
      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/across workspaces/i);

      await service.from('person').delete().eq('id', there!.id);
    } finally {
      await deleteThrowawayWorkspace(other);
    }
  });

  it('refuses to merge a person into itself', async () => {
    const p = await makePerson('Solo', null, `solo-${Date.now()}@example.com`);
    const { error } = await service.rpc('merge_person', {
      p_keep: p,
      p_merge: p,
      p_actor: null,
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/into itself/i);
  });

  it('refuses to undo the same merge twice', async () => {
    const keep = await makePerson('Undo', 'Once', `undo1-${Date.now()}@example.com`);
    const dupe = await makePerson('Undo', 'Twice', `undo2-${Date.now()}@example.com`);
    const { data: mergeId } = await service.rpc('merge_person', {
      p_keep: keep,
      p_merge: dupe,
      p_actor: null,
    });
    const first = await service.rpc('unmerge_person', { p_merge_id: mergeId, p_actor: null });
    expect(first.error).toBeNull();
    const second = await service.rpc('unmerge_person', { p_merge_id: mergeId, p_actor: null });
    expect(second.error).not.toBeNull();
    expect(second.error!.message).toMatch(/already undone/i);
  });
});

describe('person_duplicate_candidates', () => {
  it('finds a shared address, an identical name, and a near-miss name', async () => {
    const stamp = Date.now();
    const shared = `shared-${stamp}@example.com`;
    const a = await makePerson('Shared', 'Address', shared);
    const b = await makePerson('Also', 'Shared', shared);
    const c = await makePerson('Twin', 'Name', `twin-a-${stamp}@example.com`);
    const d = await makePerson('Twin', 'Name', `twin-b-${stamp}@example.com`);
    const e = await makePerson('Jonathan', 'Kleinsma', `jk1-${stamp}@example.com`);
    const f = await makePerson('Jonathon', 'Kleinsma', `jk2-${stamp}@example.com`);

    const { data, error } = await service.rpc('person_duplicate_candidates', {
      p_workspace: ws,
      p_limit: 200,
      p_threshold: 0.55,
    });
    expect(error).toBeNull();

    const pairs = (data ?? []) as { person_a: string; person_b: string; reason: string }[];
    const has = (x: string, y: string, reason: string) =>
      pairs.some(
        (p) =>
          p.reason === reason &&
          ((p.person_a === x && p.person_b === y) || (p.person_a === y && p.person_b === x)),
      );

    expect(has(a, b, 'same_email')).toBe(true);
    expect(has(c, d, 'same_name')).toBe(true);
    // The case deterministic matching misses, and the reason pg_trgm is here
    // instead of a language model.
    expect(has(e, f, 'similar_name')).toBe(true);

    // Each pair once, never both orderings.
    const keys = pairs.map((p) => [p.person_a, p.person_b, p.reason].join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});
