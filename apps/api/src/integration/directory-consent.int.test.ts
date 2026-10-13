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

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
