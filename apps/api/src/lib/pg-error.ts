// Postgres errors reaching a user.
//
// A save that fails a constraint used to put the raw driver string into the
// dialog — `new row for relation "thread_engagement" violates check
// constraint "thread_engagement_trigger_anchor_check"` — clipped mid-sentence
// by the footer's width. True, and useless to the person who typed the form.
//
// So: one sentence for the human, and the raw error kept alongside it under
// `detail` (plus the full object in the server log, which stays the first
// stop when debugging — see CLAUDE.md).
//
// Names we recognise get a real sentence. Everything else gets an honest
// generic one; adding a case here is how a new constraint stops being
// cryptic.

type PgLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

/** Constraint name → what the person filling in the form needs to hear. */
const BY_CONSTRAINT: Record<string, string> = {
  thread_engagement_window_chk: 'The end time has to be after the start time.',
  thread_engagement_type_check: 'That is not a type this timeline knows.',
  thread_engagement_status_check: 'That is not a status this timeline knows.',
  thread_engagement_trigger_kind_check: 'That is not a way of triggering a message.',
  thread_engagement_trigger_anchor_check: 'That is not something a message can be anchored to.',
  thread_ticket_price_chk: 'A price cannot be negative.',
  thread_coupon_type_check: 'That is not a kind of discount code.',
};

/** Errors that are about a shape rather than a named constraint. */
function byCode(e: PgLike): string | null {
  switch (e.code) {
    case '23505':
      return 'Something with these details already exists.';
    case '23503':
      return 'This points at something that no longer exists.';
    case '23502':
      return 'A required field was left empty.';
    case '22001':
      return 'One of the fields is longer than it is allowed to be.';
    case '22007':
    case '22008':
      return 'One of the dates or times could not be read.';
    case '42501':
      return 'You do not have permission to change this.';
    // A trigger's `raise exception`. Every one of these in this codebase is
    // written for a person — "activity is append-only, write a correction row
    // instead", "this message has already been sent to 2 people…" — so the
    // raise text IS the sentence, and replacing it with a generic one throws
    // away the only part that says what to do instead.
    case 'P0001':
      return e.message ?? null;
    // PostgREST: .single() found no row — deleted, or invisible under RLS.
    case 'PGRST116':
      return 'This could not be found. It may have been deleted, or you may not have access to it.';
    default:
      return null;
  }
}

function constraintName(e: PgLike): string | null {
  const m = /violates (?:check|foreign key|unique) constraint "([^"]+)"/.exec(e.message ?? '');
  return m?.[1] ?? null;
}

/** One sentence, safe to show in a dialog. */
export function pgErrorMessage(e: PgLike): string {
  const named = constraintName(e);
  if (named && BY_CONSTRAINT[named]) return BY_CONSTRAINT[named];
  const coded = byCode(e);
  if (coded) return coded;
  return 'The database would not accept this change.';
}

/** HTTP status matching the cause — a rejected value is the caller's, not ours. */
export function pgErrorStatus(e: PgLike): 400 | 403 | 404 | 409 | 500 {
  if (e.code === '23505') return 409;
  // A trigger refusing on purpose is a conflict with the world's state, not a
  // fault. Without this the freeze-once-sent rule reads as a 500 in the editor.
  if (e.code === 'P0001') return 409;
  if (e.code === '42501') return 403;
  if (e.code === 'PGRST116') return 404;
  if (e.code && /^(23|22)/.test(e.code)) return 400;
  return 500;
}

/** The body to return: a sentence for the dialog, the raw text for whoever is
 *  reading the network tab. */
export function pgErrorBody(e: PgLike): { error: string; detail?: string; code?: string } {
  return {
    error: pgErrorMessage(e),
    ...(e.message ? { detail: e.message } : {}),
    ...(e.code ? { code: e.code } : {}),
  };
}
