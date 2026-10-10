// Claiming the right to send one message, and recording how it went.
//
// `thread_message_send` is the dedup for every scheduled and triggered send:
// one row per (engagement, person), written BEFORE the email is attempted so
// that overlapping ticks and retries cannot mail somebody twice. That part is
// right and stays.
//
// What was wrong, until 2026-10-10, is that the row said nothing about
// whether the mail ACTUALLY WENT. The insert happened, the transport then
// threw, and the row remained — so the scheduler treated that message as done
// for ever. Watching a real send fail on staging is what showed it: Resend
// refused the address, the log said `0 email(s) sent`, and the row sat there
// marking a message nobody would ever receive. The same thing happens on
// production for a Resend outage, a bounced domain or an expired key, and
// nobody is told.
//
// So the row now carries a verdict, and these two functions are the only
// things that write it. They are deliberately NOT a shared "send" — the three
// callers build genuinely different messages (the lifecycle path attaches a
// ticket and the workspace's brand; the scheduler does not; the hold release
// rebuilds from stored rows) and forcing one shape on them would be the kind
// of merge that loses a ticket attachment. What they share is the bookkeeping.

import { adminClient } from '../db.js';

/**
 * How many times the transport may be asked before we stop.
 *
 * Three, because the failures worth retrying are transient — a provider
 * blip, a timeout — and the ones that are not (a malformed address, a
 * suspended domain) would otherwise be retried every five minutes for the
 * whole 72-hour lookback: some 800 rejected API calls, ending in the same
 * silence. After three the row keeps `failed_at` and stops, which is a
 * message that did not arrive and SAYS so.
 */
export const MAX_SEND_ATTEMPTS = 3;

export type SendClaim =
  /** Nobody has sent this and you may try. */
  | 'claimed'
  /** Already delivered — do not send it again. */
  | 'already-sent'
  /** Failed too many times, or the bookkeeping itself failed. Leave it. */
  | 'given-up';

/**
 * Ask for the right to send one message.
 *
 * A fresh (engagement, person) inserts and is claimed. An existing row is
 * read: no `failed_at` means it went, so the answer is `already-sent` and the
 * caller must not mail again. A row that failed and still has attempts left
 * is claimed again, with the attempt counted.
 *
 * The scheduler runs under a lease (`withSchedulerLease`), so in practice one
 * process is doing this at a time; the read-then-update below is therefore
 * not protected against a concurrent claimer, and does not need to be. If
 * that ever stops being true, the update needs a `.lt('attempts', MAX)`
 * guard — worse outcome would be one duplicate email, not a lost one.
 */
export async function claimSend(opts: {
  engagementId: string;
  personId: string;
  email: string;
}): Promise<SendClaim> {
  const insert = await adminClient.from('thread_message_send').insert({
    engagement_id: opts.engagementId,
    person_id: opts.personId,
    email: opts.email,
    attempts: 1,
  });
  if (!insert.error) return 'claimed';
  if (insert.error.code !== '23505') {
    // Not a duplicate: the bookkeeping is broken. Do NOT send — an unlogged
    // send is the one failure mode worse than a missing one, because it can
    // repeat on every tick.
    console.warn('[send-record] could not claim a send', insert.error.message);
    return 'given-up';
  }

  const { data: row, error } = await adminClient
    .from('thread_message_send')
    .select('id, failed_at, attempts')
    .eq('engagement_id', opts.engagementId)
    .eq('person_id', opts.personId)
    .maybeSingle();
  if (error || !row) {
    console.warn('[send-record] duplicate with no readable row', error?.message);
    return 'given-up';
  }
  // The row is the record of a message that WENT.
  if (!row.failed_at) return 'already-sent';

  const attempts = (row.attempts as number | null) ?? 1;
  if (attempts >= MAX_SEND_ATTEMPTS) return 'given-up';

  const bump = await adminClient
    .from('thread_message_send')
    .update({ attempts: attempts + 1 })
    .eq('id', row.id as string);
  if (bump.error) {
    console.warn('[send-record] could not count a retry', bump.error.message);
    return 'given-up';
  }
  return 'claimed';
}

/**
 * Say how it went, once the transport has answered.
 *
 * Success clears `failed_at` and stamps `sent_at` with the moment it actually
 * went — which on a retry is not when the row was first written. Failure
 * stamps `failed_at`, which is what lets the next tick try again and what
 * makes a message that never arrived visible afterwards.
 */
export async function recordSendResult(opts: {
  engagementId: string;
  personId: string;
  sent: boolean;
}): Promise<void> {
  const patch = opts.sent
    ? { failed_at: null, sent_at: new Date().toISOString() }
    : { failed_at: new Date().toISOString() };
  const { error } = await adminClient
    .from('thread_message_send')
    .update(patch)
    .eq('engagement_id', opts.engagementId)
    .eq('person_id', opts.personId);
  if (error) {
    // Worth shouting about on a FAILURE: the row now says "sent" for a
    // message that did not go, which is the exact bug this file exists to
    // remove.
    console.error('[send-record] could not record the send result', {
      sent: opts.sent,
      engagement: opts.engagementId,
      error: error.message,
    });
  }
}
