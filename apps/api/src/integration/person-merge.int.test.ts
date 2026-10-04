// Merging two people, against real Postgres.
//
// This is the riskiest code in the person-SPoT work: merge_person discovers
// every FK pointing at public.person from pg_constraint and repoints them, so
// a mistake silently moves — or loses — somebody's enrolments, payments and
// history. A unit test cannot exercise any of that, because the whole point
// is what the catalogue says and what the unique constraints do.
//
// A PERMANENT fixture workspace, fixture rows retired by their own ids.
// Staging only, per the harness rules. It was a throwaway workspace until
// 2026-10-01: the merge tests write `activity`, which is append-only and pins
// the person and so the workspace, and fifty of them stood on staging — one
// per run — because the cleanup never read its own answer.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  getPermanentFixtureWorkspace,
  service,
} from './staging.js';

const MERGE_FIXTURE_WS_SLUG = 'int-merge-fixtures';

/** Out of every list, for good: a person with activity cannot be removed. */
async function retire(ids: string[]) {
  if (!ids.length) return;
  const { error } = await service
    .from('person')
    .update({ deleted_at: new Date().toISOString() })
    .in('id', ids)
    .is('deleted_at', null);
  if (error) console.error(`[fixture cleanup] merge persons soft-delete: ${error.message}`);
}

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
  ws = await getPermanentFixtureWorkspace(MERGE_FIXTURE_WS_SLUG);
  // person_duplicate_candidates looks at the whole workspace, so anybody a
  // crashed run left live would turn up as a candidate in this one.
  const { data: stale, error } = await service
    .from('person')
    .select('id')
    .eq('workspace_id', ws)
    .is('deleted_at', null);
  if (error) throw new Error(`merge fixtures: ${error.message}`);
  await retire((stale ?? []).map((p) => p.id as string));
  const { data: app } = await service.from('app').select('id').eq('slug', 'fibre-platform').single();
  appId = app!.id as string;
});

afterAll(async () => {
  // No `delete from activity`: the log is append-only even for the service
  // role, and that statement had been refused on every run. The audit rows
  // and the people are retired instead; the workspace stays.
  if (madePeople.length) await retire(madePeople);
});

describe('merge_person', () => {
  // The point of this test is to FAIL when somebody adds a column to person.
  //
  // person_merge_fill_blanks carries the merged record's values into the kept
  // record's blanks, and it decides what may travel from the catalogue rather
  // than from a list. That is the right default for content and the wrong one
  // for a legal fact: an `erased_at`, a `marketing_consent`, a `verified_by`
  // must NOT ride across from one person to another. The type and suffix
  // rules in person_fillable_columns() are meant to catch those, but a rule
  // is a guess about names nobody has chosen yet.
  //
  // So this asserts the exact set. A new column lands here as a red test, and
  // whoever added it decides — add it to this list, or name it so the rule
  // excludes it. The failure is the feature.
  it('carries content and nothing else — a new person column must be classified', async () => {
    const { data, error } = await service.rpc('person_fillable_columns');
    expect(error).toBeNull();

    const got = ((data ?? []) as ({ name: string } | string)[])
      .map((r) => (typeof r === 'string' ? r : r.name))
      .sort();

    expect(got).toEqual(
      [
        'city',
        'country',
        'custom_fields',
        'email',
        'email_secondary',
        'first_name',
        'languages_spoken',
        'last_name',
        'linkedin_url',
        'phone',
        'phone_secondary',
        'postal_code',
        'preferred_language',
        'preferred_name',
        'pronouns',
        'region',
        'street',
        'website_url',
      ].sort(),
    );

    // and the ones that must never travel, named so the reason is on the page
    for (const identity of ['id', 'workspace_id', 'user_id', 'merged_into', 'created_via']) {
      expect(got).not.toContain(identity);
    }
    for (const state of ['created_at', 'deleted_at']) {
      expect(got).not.toContain(state);
    }
  });

  // An undo reverses the merge, not the afternoon's work.
  it('leaves a column alone on undo when somebody edited it after the merge', async () => {
    const stamp = Date.now();
    const keep = (
      await service
        .from('person')
        .insert({ workspace_id: ws, first_name: 'Edited', last_name: null, phone: null })
        .select('id')
        .single()
    ).data!.id as string;
    madePeople.push(keep);

    const lose = (
      await service
        .from('person')
        .insert({ workspace_id: ws, first_name: 'Edited', last_name: 'Carried', phone: '+31611111111' })
        .select('id')
        .single()
    ).data!.id as string;
    madePeople.push(lose);

    const { data: mergeId } = await service.rpc('merge_person', {
      p_keep: keep,
      p_merge: lose,
      p_actor: null,
    });

    // a human corrects the phone the merge filled in
    await service.from('person').update({ phone: '+31699999999' }).eq('id', keep);

    await service.rpc('unmerge_person', { p_merge_id: mergeId as string, p_actor: null });

    const back = (
      await service.from('person').select('phone, last_name').eq('id', keep).single()
    ).data!;
    expect(back.phone).toBe('+31699999999'); // theirs survives
    expect(back.last_name).toBeNull();       // untouched, so reverted
  });

  // Sjoerd, 2026-09-25: *"can you also merge contact (not just choose). For
  // example: two email addresses belong to each other"*. Before 20260925053333
  // a merge combined the ROWS pointing at a person and never the person's own
  // columns, so anything the keeper had left blank stayed blank — the merged
  // record's surname, phone and second address were on screen nowhere, even
  // though the contact points themselves had moved across.
  it('fills the keeper\'s BLANK fields from the merged record, and never overwrites one they had', async () => {
    const stamp = Date.now();
    const { data: keepRow } = await service
      .from('person')
      .insert({
        workspace_id: ws,
        first_name: 'Probe',
        last_name: null,                        // blank — should be filled
        email: `probe-a-${stamp}@example.com`,  // held — must NOT be overwritten
        phone: null,                            // blank — should be filled
        city: null,                             // blank — should be filled
      })
      .select('id')
      .single();
    const keep = keepRow!.id as string;
    madePeople.push(keep);

    const lose = (
      await service
        .from('person')
        .insert({
          workspace_id: ws,
          first_name: 'Probe',
          last_name: 'Surname',
          email: `probe-b-${stamp}@example.com`,
          phone: '+31612345678',
          city: 'Zierikzee',
        })
        .select('id')
        .single()
    ).data!.id as string;
    madePeople.push(lose);

    const { data: mergeId, error } = await service.rpc('merge_person', {
      p_keep: keep,
      p_merge: lose,
      p_actor: null,
    });
    expect(error).toBeNull();

    const after = (
      await service
        .from('person')
        .select('last_name, email, email_secondary, phone, city')
        .eq('id', keep)
        .single()
    ).data!;

    expect(after.last_name).toBe('Surname');
    expect(after.phone).toBe('+31612345678');
    expect(after.city).toBe('Zierikzee');
    // the second address — the thing that prompted this
    expect(after.email_secondary).toBe(`probe-b-${stamp}@example.com`);
    // and the address they already had is untouched: "keep this one" still means it
    expect(after.email).toBe(`probe-a-${stamp}@example.com`);

    // undo puts every filled column back to blank, not to the merged value
    const { error: undoErr } = await service.rpc('unmerge_person', {
      p_merge_id: mergeId as string,
      p_actor: null,
    });
    expect(undoErr).toBeNull();

    const back = (
      await service
        .from('person')
        .select('last_name, email, email_secondary, phone, city')
        .eq('id', keep)
        .single()
    ).data!;
    expect(back.last_name).toBeNull();
    expect(back.phone).toBeNull();
    expect(back.city).toBeNull();
    expect(back.email_secondary).toBeNull();
    expect(back.email).toBe(`probe-a-${stamp}@example.com`);
  });

  // The screen now PROMISES what a merge will fill in, and the promise is
  // only worth making if it comes from the same place the merge does. This is
  // the test that keeps them honest: predict, merge, compare. If someone adds
  // a column to person_fillable_columns and only the fill learns about it,
  // this goes red rather than the page quietly under-promising.
  it('the preview names exactly the columns the merge then fills', async () => {
    const stamp = Date.now();
    const keep = (
      await service
        .from('person')
        .insert({
          workspace_id: ws,
          first_name: 'Preview',
          last_name: null, //  blank — the merge will fill it
          email: `preview-a-${stamp}@example.com`, // held — must not move
          phone: null, //      blank — the merge will fill it
          city: null, //       blank — the merge will fill it
        })
        .select('id')
        .single()
    ).data!.id as string;
    madePeople.push(keep);

    const lose = (
      await service
        .from('person')
        .insert({
          workspace_id: ws,
          first_name: 'Preview',
          last_name: 'Vermeer',
          email: `preview-b-${stamp}@example.com`,
          phone: '+31611122233',
          city: 'Deventer',
        })
        .select('id')
        .single()
    ).data!.id as string;
    madePeople.push(lose);

    // Ask BEFORE touching anything.
    const predicted = (
      await service.rpc('person_merge_fill_preview', { p_keep: keep, p_merge: lose })
    ).data as string[];

    const { error } = await service.rpc('merge_person', {
      p_keep: keep,
      p_merge: lose,
      p_actor: null,
    });
    expect(error).toBeNull();

    // `filled` is what the merge recorded itself doing, column by column.
    const filled = (
      await service
        .from('person_merge')
        .select('filled')
        .eq('kept_person_id', keep)
        .eq('merged_person_id', lose)
        .single()
    ).data!.filled as Record<string, unknown>;

    // The WHOLE set, compared both ways round: a preview that misses a column
    // under-promises, one that invents a column lies, and only an equality
    // catches both.
    //
    // This originally excluded `_secondary` columns from the comparison, and
    // that exclusion was hiding a real bug rather than accommodating one — the
    // first version of the preview looked only at the KEEPER's contact points,
    // so it never saw the second email the merge would rescue once the loser's
    // points had been repointed. Filtering the disagreement out of the
    // assertion would have shipped a screen that promised three fields and
    // delivered four. Fixed in 20261004070803; the assertion is now total.
    const actually = Object.keys(filled).sort();
    expect([...predicted].sort()).toEqual(actually);

    // And it was not vacuously empty — a test where both sides are [] would
    // pass while the feature did nothing at all.
    expect(actually).toContain('last_name');
    expect(actually).toContain('email_secondary');
    expect(actually.length).toBeGreaterThan(1);
  });

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
