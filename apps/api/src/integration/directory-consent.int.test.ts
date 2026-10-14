// Appearing in a directory is a CONSENT, so the record is the thing under test.
//
// Two surfaces now ask the same question — the portal switch a member flips
// later, and the checkbox on the public join form — and they write through one
// function. What matters is not that each works but that what lands is
// identical, because the entry row is the behaviour and the consent_record row
// is the evidence an Article 15 export reads back.
//
// Against STAGING, in a throwaway workspace, and everything it makes it
// removes.

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';
import { setDirectoryListing, DIRECTORY_CONSENT_VERSION } from '../lib/directory-consent.js';

let ws = '';
let personId = '';

beforeAll(async () => {
  ws = await createThrowawayWorkspace('dirconsent');
  const { data, error } = await service
    .from('person')
    .insert({
      workspace_id: ws,
      first_name: 'Dir',
      last_name: 'Consent',
      email: 'int-dir-consent@example.com',
    })
    .select('id')
    .single();
  if (error) throw new Error(`person fixture: ${error.message}`);
  personId = data!.id as string;
}, 120_000);

afterAll(async () => {
  await service.from('consent_record').delete().eq('person_id', personId);
  await service.from('membership_directory_entry').delete().eq('workspace_id', ws);
  if (ws) await deleteThrowawayWorkspace(ws);
});

const entries = async () => {
  const { data } = await service
    .from('membership_directory_entry')
    .select('listed, show_contact')
    .eq('workspace_id', ws)
    .eq('person_id', personId);
  return data ?? [];
};
const consents = async () => {
  const { data } = await service
    .from('consent_record')
    .select('purpose_code, legal_basis, text_version, revoked_at')
    .eq('person_id', personId)
    .eq('purpose_code', 'member_directory')
    .order('granted_at'); // NOT created_at — this table has granted_at/revoked_at
  // (asked of the migration after an unordered read came back empty: a sort on
  // a column that does not exist errors, and the error read as "no consent").
  return data ?? [];
};

describe('the one directory writer', () => {
  it('a yes writes the entry AND the consent record, with its text version', async () => {
    expect(await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: true })).toEqual({
      ok: true,
    });
    expect((await entries())[0]?.listed, 'listed').toBe(true);
    const c = await consents();
    expect(c, 'one consent record').toHaveLength(1);
    expect(c[0]!.legal_basis).toBe('consent');
    expect(c[0]!.text_version, 'which words they agreed to').toBe(DIRECTORY_CONSENT_VERSION);
    expect(c[0]!.revoked_at).toBeNull();
  }, 60_000);

  it('a second yes does not pretend to be a second consent', async () => {
    // The join checkbox and the portal switch can both fire for one person —
    // a member who ticked the box and then opens their portal. Consent was
    // given once; the record says once.
    await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: true });
    expect(await consents(), 'still one').toHaveLength(1);
  }, 60_000);

  it('editing show_contact alone writes no consent at all', async () => {
    await setDirectoryListing({ workspaceId: ws, personIds: [personId], showContact: true });
    expect((await entries())[0]?.show_contact).toBe(true);
    expect((await entries())[0]?.listed, 'and leaves listed alone').toBe(true);
    expect(await consents(), 'no new record for a different field').toHaveLength(1);
  }, 60_000);

  it('a no revokes the record rather than deleting it — the evidence stays', async () => {
    await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: false });
    expect((await entries())[0]?.listed).toBe(false);
    const c = await consents();
    expect(c, 'the record is still there').toHaveLength(1);
    expect(c[0]!.revoked_at, 'and it is marked revoked').not.toBeNull();
  }, 60_000);

  it('and a yes after a no is a NEW consent, because it is one', async () => {
    await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: true });
    const c = await consents();
    expect(c, 'two records now').toHaveLength(2);
    expect(c.filter((r) => r.revoked_at === null), 'exactly one live').toHaveLength(1);
  }, 60_000);

  it('refuses when it has nobody to list', async () => {
    const r = await setDirectoryListing({ workspaceId: ws, personIds: [], listed: true });
    expect(r.ok).toBe(false);
  }, 60_000);
});

describe('two writers at once', () => {
  // What the sequential tests above cannot see, and what actually happened:
  // Sjoerd's staging join recorded the same consent twice, 84ms apart,
  // because both webhooks read "not listed yet" before either wrote.
  it('records ONE consent when two callers say yes simultaneously', async () => {
    const { data: person } = await service
      .from('person')
      .insert({
        workspace_id: ws,
        first_name: 'Race',
        last_name: 'Condition',
        email: 'int-dir-race@example.com',
      })
      .select('id')
      .single();
    const pid = person!.id as string;

    // THE GUARANTEE, asserted where it lives. The concurrent pair below is
    // the shape the bug had, but it is not a reliable reproduction — two
    // awaited calls through one client do not always interleave, and an
    // earlier version of this test passed before the index existed, which is
    // the definition of proving nothing. This is deterministic: the database
    // must refuse a second LIVE consent for the same person and purpose.
    const first = await service.from('consent_record').insert({
      person_id: pid,
      purpose_code: 'member_directory',
      legal_basis: 'consent',
      text_version: 'member-directory-v1',
    });
    expect(first.error, 'the first consent is recorded').toBeNull();
    const second = await service.from('consent_record').insert({
      person_id: pid,
      purpose_code: 'member_directory',
      legal_basis: 'consent',
      text_version: 'member-directory-v1',
    });
    expect(second.error?.code, 'and the second is refused by the database').toBe('23505');

    // BUT A NEW VERSION OF THE WORDS IS A NEW CONSENT, and must be
    // recordable. Without text_version in the key, a member accepting terms
    // v2 would hit the same index, the writer would call it success, and the
    // acceptance would never be recorded — an evidence table dropping the
    // evidence. (Caught in review before this shipped.)
    const v2 = await service.from('consent_record').insert({
      person_id: pid,
      purpose_code: 'member_directory',
      legal_basis: 'consent',
      text_version: 'member-directory-v2',
    });
    expect(v2.error, 'a new version is recorded, not swallowed').toBeNull();

    await service.from('consent_record').delete().eq('person_id', pid);

    const both = await Promise.all([
      setDirectoryListing({ workspaceId: ws, personIds: [pid], listed: true }),
      setDirectoryListing({ workspaceId: ws, personIds: [pid], listed: true }),
    ]);
    // Both report success: losing this race is not a failure, it means the
    // other caller recorded the same consent.
    expect(both.every((r) => r.ok), JSON.stringify(both)).toBe(true);

    const { data: rows } = await service
      .from('consent_record')
      .select('granted_at')
      .eq('person_id', pid)
      .eq('purpose_code', 'member_directory')
      .is('revoked_at', null);
    expect(rows ?? [], 'one consent, not two').toHaveLength(1);

    await service.from('consent_record').delete().eq('person_id', pid);
    await service.from('membership_directory_entry').delete().eq('person_id', pid);
    await service.from('person').delete().eq('id', pid);
  }, 60_000);
});

// ---------------------------------------------------------------------------
// THE TWO INCONSISTENT STATES, and that the writer repairs them.
//
// The ordering fix of 2026-10-14 made one of these reachable and left the
// other unreachable: whichever step fails, the state left behind is never
// "shown without a record" — but a row could still end up listed with no
// consent (from the OLD ordering, before the fix) or consented but not listed
// (from the new one, if the entry write fails).
//
// Both were then skipped by the very operation that would repair them,
// because the writer only acted on rows that were CHANGING. A filter that
// excludes the broken case is a filter that preserves it, so the insert and
// the revoke cover every person row now, and the unique index makes that
// idempotent rather than noisy.
// ---------------------------------------------------------------------------
describe('repairing a row that is out of step', () => {
  beforeEach(async () => {
    await service.from('consent_record').delete().eq('person_id', personId);
    await service.from('membership_directory_entry').delete().eq('workspace_id', ws);
  });

  it('a yes writes the missing consent for a row that is ALREADY listed', async () => {
    // The old ordering's leftover: listed, with no evidence behind it. This
    // is the state the record exists to make impossible, so saying yes again
    // must fix it rather than shrug because nothing is "changing".
    const seeded = await service
      .from('membership_directory_entry')
      .insert({ workspace_id: ws, person_id: personId, listed: true });
    expect(seeded.error, seeded.error?.message).toBeNull();
    expect(await consents()).toHaveLength(0);

    const r = await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: true });
    expect(r).toEqual({ ok: true });

    const after = await consents();
    expect(after, 'the consent is written even though the entry did not change').toHaveLength(1);
    expect(after[0]?.revoked_at).toBeNull();
  });

  it('a no revokes a LIVE consent even when the row is not listed', async () => {
    // The mirror: consented, never shown. Scoping the revoke to rows that
    // were listed meant this consent could never be withdrawn — the untick
    // would skip it and the record would stay live for good.
    await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: true });
    const unlisted = await service
      .from('membership_directory_entry')
      .update({ listed: false })
      .eq('workspace_id', ws)
      .eq('person_id', personId);
    expect(unlisted.error, unlisted.error?.message).toBeNull();
    expect((await consents()).filter((c) => !c.revoked_at), 'live before the untick').toHaveLength(1);

    const r = await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: false });
    expect(r).toEqual({ ok: true });

    expect(
      (await consents()).filter((c) => !c.revoked_at),
      'the live consent is withdrawn, not left behind',
    ).toHaveLength(0);
  });

  it('a no for somebody who never consented invents no withdrawal', async () => {
    // The guard on the case above: revoking "for everyone" must not write a
    // withdrawal that never happened. `.is('revoked_at', null)` touches only
    // rows that exist and are live, so a person with no record has nothing
    // updated.
    const r = await setDirectoryListing({ workspaceId: ws, personIds: [personId], listed: false });
    expect(r).toEqual({ ok: true });
    expect(await consents()).toHaveLength(0);
  });
});
