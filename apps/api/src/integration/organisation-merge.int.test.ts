// merge_organisation: what it carries, and whether undo can reverse it.
//
// It used to carry a hand-written list of eight columns, so every column
// added to `organisation` after it was written was dropped on the floor
// without a word — thirteen of them by 2026-10-11, including the address, the
// LinkedIn page, the abbreviation and the former names. It derives the list
// from the catalogue now (20261011202050), the way person merge has since
// 2026-09-25.
//
// A derived rule is a guess about names nobody has chosen yet, so the first
// test here asserts the EXACT set: a new organisation column lands as a red
// build and whoever added it decides. The failure is the feature.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createThrowawayWorkspace,
  deleteThrowawayWorkspace,
  service,
} from './staging.js';

let ws = '';
const made: string[] = [];

async function makeOrg(fields: Record<string, unknown>) {
  const { data, error } = await service
    .from('organisation')
    .insert({ workspace_id: ws, ...fields })
    .select('id')
    .single();
  if (error) throw new Error(`fixture organisation: ${error.message}`);
  made.push(data!.id as string);
  return data!.id as string;
}

async function read(id: string) {
  const { data, error } = await service.from('organisation').select('*').eq('id', id).single();
  if (error) throw new Error(`read organisation: ${error.message}`);
  return data as Record<string, unknown>;
}

async function merge(keep: string, mergeId: string): Promise<string> {
  const { data, error } = await service.rpc('merge_organisation', {
    p_keep: keep,
    p_merge: mergeId,
    p_actor: null,
  });
  if (error) throw new Error(`merge_organisation: ${error.message}`);
  return data as string;
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('orgmerge');
}, 120_000);

afterAll(async () => {
  if (made.length) {
    // Merge audit rows reference the organisations; clear them first.
    const { error } = await service.from('organisation_merge').delete().eq('workspace_id', ws);
    if (error) console.error(`[fixtures] organisation_merge: ${error.message}`);
    const { error: oErr } = await service.from('organisation').delete().in('id', made);
    if (oErr) console.error(`[fixtures] organisations: ${oErr.message}`);
  }
  if (ws) await deleteThrowawayWorkspace(ws);
}, 120_000);

describe('merge_organisation', () => {
  // THE POINT OF THIS TEST IS TO FAIL when somebody adds a column to
  // organisation.
  //
  // The fill decides what may travel from the catalogue rather than from a
  // list, which is the right default for content and the wrong one for
  // anything that is a fact about one specific record. The type and suffix
  // rules are meant to catch those, but they are a guess about names nobody
  // has chosen yet. So: assert the exact set. A new column arrives here red,
  // and whoever added it either lists it or names it so the rule excludes it.
  it('carries content and nothing else — a new organisation column must be classified', async () => {
    const { data, error } = await service.rpc('organisation_fillable_columns');
    expect(error).toBeNull();

    const got = ((data ?? []) as ({ name: string } | string)[])
      .map((r) => (typeof r === 'string' ? r : r.name))
      .sort();

    expect(got).toEqual(
      [
        'city',
        'country',
        'domain',
        'industry',
        'legal_name',
        'linkedin_url',
        'logo_url',
        'name',
        'operating_countries',
        'org_type',
        'other_names',
        'postal_code',
        'region',
        'registration_number',
        'sector',
        'short_name',
        'size_band',
        'street',
        'vat_number',
        'website',
      ].sort(),
    );

    // Named so the reason is on the page rather than in a migration.
    for (const identity of ['id', 'workspace_id', 'merged_into', 'parent_org_id']) {
      expect(got, `${identity} is identity, never content`).not.toContain(identity);
    }
    for (const state of ['created_at', 'deleted_at', 'domain_verified_at']) {
      expect(got, `${state} is state, and belongs to the record it was set on`).not.toContain(state);
    }
    // Maintained by organisation_search_names_sync; writing it is a no-op.
    expect(got, 'search_names is derived by a trigger').not.toContain('search_names');
  });

  // The thirteen columns the old list dropped. `street` stands for them: it
  // was content, it existed, and a merge silently lost it.
  it('fills a blank from a column the old eight-column list never carried', async () => {
    const keep = await makeOrg({ name: 'Keep BV' });
    const lose = await makeOrg({
      name: 'Lose BV',
      street: 'Keizersgracht 1',
      postal_code: '1015 CJ',
      linkedin_url: 'https://linkedin.com/company/lose',
      short_name: 'LBV',
    });

    await merge(keep, lose);

    const after = await read(keep);
    expect(after.street, 'street was dropped by the hand-written list').toBe('Keizersgracht 1');
    expect(after.postal_code).toBe('1015 CJ');
    expect(after.linkedin_url).toBe('https://linkedin.com/company/lose');
    expect(after.short_name).toBe('LBV');
  });

  // Filling gaps, not deciding between two answers: the person chose which
  // row to keep, so what that row already says is what it keeps saying.
  it('never overwrites an answer the kept row already had', async () => {
    const keep = await makeOrg({ name: 'Answered BV', street: 'Herengracht 2', city: 'Amsterdam' });
    const lose = await makeOrg({ name: 'Other BV', street: 'Elsewhere 9', city: 'Rotterdam' });

    await merge(keep, lose);

    const after = await read(keep);
    expect(after.street).toBe('Herengracht 2');
    expect(after.city).toBe('Amsterdam');
  });

  // Undo has to reverse the fill, or widening it from eight columns to
  // nineteen would make undo lossier in exact proportion to the improvement.
  it('undo puts a filled blank back to blank', async () => {
    const keep = await makeOrg({ name: 'Roundtrip BV' });
    const lose = await makeOrg({ name: 'Donor BV', street: 'Singel 3', sector: 'Energy' });

    const mergeId = await merge(keep, lose);
    expect((await read(keep)).street, 'the merge filled it').toBe('Singel 3');

    const { error } = await service.rpc('unmerge_organisation', {
      p_merge_id: mergeId,
      p_actor: null,
    });
    expect(error).toBeNull();

    const after = await read(keep);
    expect(after.street, 'undo reversed the fill').toBeNull();
    expect(after.sector).toBeNull();
    // And the merged record is live again.
    expect((await read(lose)).deleted_at).toBeNull();
  });

  // THE ONE THAT PROTECTS SOMEBODY'S WORK. An undo reverses the merge, not
  // the afternoon: if a human corrected a filled value afterwards, that
  // correction is theirs and must survive.
  it('undo leaves a value a human corrected after the merge', async () => {
    const keep = await makeOrg({ name: 'Edited BV' });
    const lose = await makeOrg({ name: 'Donor Two BV', street: 'Prinsengracht 4' });

    const mergeId = await merge(keep, lose);
    expect((await read(keep)).street).toBe('Prinsengracht 4');

    // Somebody fixes the street by hand.
    const { error: upErr } = await service
      .from('organisation')
      .update({ street: 'Prinsengracht 40' })
      .eq('id', keep);
    expect(upErr).toBeNull();

    const { error } = await service.rpc('unmerge_organisation', {
      p_merge_id: mergeId,
      p_actor: null,
    });
    expect(error).toBeNull();

    expect(
      (await read(keep)).street,
      'an undo reverses the merge, not the correction made since',
    ).toBe('Prinsengracht 40');
  });

  // The audit is what undo reads, so it has to say what happened.
  it('records what was filled, with both halves', async () => {
    const keep = await makeOrg({ name: 'Audited BV' });
    const lose = await makeOrg({ name: 'Donor Three BV', region: 'Zeeland' });

    const mergeId = await merge(keep, lose);

    const { data, error } = await service
      .from('organisation_merge')
      .select('filled')
      .eq('id', mergeId)
      .single();
    expect(error).toBeNull();
    const filled = (data!.filled ?? {}) as Record<string, { before: unknown; after: unknown }>;
    expect(Object.keys(filled)).toContain('region');
    expect(filled.region!.before).toBeNull();
    expect(filled.region!.after).toBe('Zeeland');
  });
});
