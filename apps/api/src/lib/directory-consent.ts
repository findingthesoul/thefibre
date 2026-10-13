// Appearing in a community's member directory — the one place that decides it.
//
// Two surfaces now ask the same question: the portal switch a member flips
// later (PATCH /me/directory), and the checkbox on the public join form. They
// must agree exactly, because what they write is not a preference but a
// CONSENT RECORD: the entry row is the behaviour, the consent_record row is
// the evidence, and an Article 15 export reads the second to explain the
// first. Two copies of that would eventually disagree about when a record is
// written, and the disagreement would show up in a regulator's question.
//
// The rules, in one place:
//
//   listed = false is the default, and a MISSING row means not listed. The
//   spec carried an opt-OUT rule until 2026-10-05; implementing it as written
//   would have listed every existing member the moment the directory shipped,
//   without anyone being asked.
//
//   A consent record is written only when `listed` CHANGES to true, and
//   revoked only when it changes to false — so a member editing show_contact
//   does not accumulate consent rows, and a second "yes" does not pretend to
//   be a second consent.

import { adminClient } from '../db.js';

export type DirectoryChoice = {
  workspaceId: string;
  /** Every person row this human has in that workspace — the caller resolves
   *  them, because the two callers resolve identity differently (a proven
   *  email in the portal, a just-created person at join). */
  personIds: string[];
  listed?: boolean | undefined;
  showContact?: boolean | null | undefined;
};

export type DirectoryResult = { ok: true } | { ok: false; step: string; message: string };

/** The text version stored with a consent record. Bump it when the words a
 *  person agrees to change, so the evidence says WHICH words they agreed to. */
export const DIRECTORY_CONSENT_VERSION = 'member-directory-v1';

export async function setDirectoryListing(choice: DirectoryChoice): Promise<DirectoryResult> {
  const { workspaceId, personIds } = choice;
  if (!personIds.length) return { ok: false, step: 'personIds', message: 'no person to list' };

  const before = await adminClient
    .from('membership_directory_entry')
    .select('person_id, listed')
    .eq('workspace_id', workspaceId)
    .in('person_id', personIds);
  if (before.error) return { ok: false, step: 'read before', message: before.error.message };
  const wasListed = (before.data ?? []).some((e) => e.listed === true);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (choice.listed !== undefined) patch.listed = choice.listed;
  if (choice.showContact !== undefined) patch.show_contact = choice.showContact;

  const { error: upsertErr } = await adminClient.from('membership_directory_entry').upsert(
    personIds.map((person_id) => ({ workspace_id: workspaceId, person_id, ...patch })),
    { onConflict: 'workspace_id,person_id' },
  );
  if (upsertErr) return { ok: false, step: 'save choice', message: upsertErr.message };

  // The consent record follows the switch, and only when it CHANGES.
  if (choice.listed === true && !wasListed) {
    const { error } = await adminClient.from('consent_record').insert(
      personIds.map((person_id) => ({
        person_id,
        purpose_code: 'member_directory',
        legal_basis: 'consent',
        text_version: DIRECTORY_CONSENT_VERSION,
      })),
    );
    if (error) return { ok: false, step: 'record consent', message: error.message };
  }
  if (choice.listed === false && wasListed) {
    // Both: the record is the evidence, the flag is the behaviour (spec §4).
    const { error } = await adminClient
      .from('consent_record')
      .update({ revoked_at: new Date().toISOString() })
      .in('person_id', personIds)
      .eq('purpose_code', 'member_directory')
      .is('revoked_at', null);
    if (error) return { ok: false, step: 'revoke consent', message: error.message };
  }

  return { ok: true };
}
