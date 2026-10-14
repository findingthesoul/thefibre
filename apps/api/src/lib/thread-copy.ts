// What "duplicate this thread" copies — every column of every table it
// touches, accounted for.
//
// The duplicate route copied a HAND-WRITTEN list of columns, and every time a
// column was added to a thread the list did not learn about it: pricing
// (2026-08-31), the daily schedule, and on 2026-10-14 the RSVP switches —
// Sjoerd: "Why did a duplicate of a thread not copy the RSVP settings?" Three
// times, each found by a customer.
//
// So each table has an explicit account here: the columns COPIED as they are,
// the columns SET to something else (with why), and the columns NOT COPIED
// (with why). An integration test reads each table's real columns from
// staging and fails when any column is in none of the three — so the NEXT
// new column fails a test, not a customer — and when a name here is not a
// real column, so a typo cannot quietly copy nothing.

export type CopySpec = {
  /** Copied exactly as they are. */
  copy: readonly string[];
  /** Given a new value by the duplicate route. Why, for each. */
  set: Readonly<Record<string, string>>;
  /** Left out on purpose. Why, for each. */
  skip: Readonly<Record<string, string>>;
};

export const THREAD_COPY: CopySpec = {
  copy: [
    'organiser_id', 'team_id', 'organisation_id', 'intention', 'timezone', 'language',
    'facilitation_language', 'public_scope', 'cover_url', 'requires_approval', 'price_cents',
    'price_currency', 'payment_destination', 'payment_methods', 'share_participants_public',
    'share_participants_participants', 'public_agenda', 'public_interaction', 'capacity',
    'registration_fields', 'certificate_enabled', 'certificate_criteria', 'certificate_template_id',
    'enrolment_note', 'rsvp_enabled', 'public_enrolment_open',
    // The roles of the system messages already seeded. Copied because the
    // copy takes those messages along (ENGAGEMENT_COPY includes
    // system_role); left empty, ensureSystemEngagements would seed them a
    // second time.
    'system_messages_seeded',
  ],
  set: {
    workspace_id: "the duplicating user's workspace",
    program_id: 'a new draft programme is made for the copy',
    slug: 'must be unique: the source slug with -copy-xxx',
    is_public_listed: 'a copy starts unlisted, so it never appears on a public page by accident',
    created_by: 'the person who pressed duplicate',
  },
  skip: {
    id: 'a new row',
    created_at: 'the copy is made now',
    updated_at: 'the copy is made now',
    locked_at: 'a copy is never locked — the lock is a decision about the original',
    locked_by: 'as locked_at',
  },
};

export const ENGAGEMENT_COPY: CopySpec = {
  copy: [
    'title', 'description', 'type', 'system_role', 'starts_at', 'ends_at', 'daily_schedule',
    'location', 'location_url', 'image_url', 'meeting_url', 'meeting_provider', 'scheduled_at',
    'trigger_kind', 'trigger_anchor', 'trigger_offset_days', 'trigger_time', 'content', 'position',
    'show_in_agenda', 'rsvp_enabled',
  ],
  set: {
    workspace_id: "the duplicating user's workspace",
    thread_id: 'the copy',
    status: 'published stays published, anything else becomes draft',
    trigger_engagement_id: 'remapped to the COPY of the anchor engagement after all are made',
    created_by: 'the person who pressed duplicate',
  },
  skip: {
    id: 'a new row',
    created_at: 'the copy is made now',
    updated_at: 'the copy is made now',
    source_app: 'an external app owns the ORIGINAL; copying its identity would make that app sync into the copy',
    source_ref: 'as source_app',
    calendar_sequence: 'no calendar invitation has gone out for the copy',
    calendar_sent_at: 'as calendar_sequence',
  },
};

export const TICKET_COPY: CopySpec = {
  copy: ['name', 'description', 'price_cents', 'price_currency', 'quantity_limit', 'available_until', 'payment_methods', 'is_active', 'position'],
  set: {
    workspace_id: "the duplicating user's workspace",
    thread_id: 'the copy',
  },
  skip: { id: 'a new row — the coupon copy maps old ticket ids to new', created_at: 'the copy is made now' },
};

export const COUPON_COPY: CopySpec = {
  copy: ['code', 'name', 'type', 'discount_percentage', 'discount_amount_cents', 'usage_limit', 'expires_at', 'is_early_bird', 'early_bird_deadline', 'is_active'],
  set: {
    workspace_id: "the duplicating user's workspace",
    thread_id: 'the copy',
    ticket_id: "remapped to the COPY of the ticket the code was limited to (null stays null)",
  },
  skip: { id: 'a new row', created_at: 'the copy is made now', used_count: 'a new code has been used by nobody' },
};

export const THREAD_CATEGORY_COPY: CopySpec = {
  copy: ['category_id'],
  set: { thread_id: 'the copy' },
  skip: {},
};

/** The copied columns of one source row. */
export function copied(spec: CopySpec, src: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const col of spec.copy) if (col in src) out[col] = src[col];
  return out;
}

/** Every column a spec accounts for. */
export function accountedFor(spec: CopySpec): Set<string> {
  return new Set([...spec.copy, ...Object.keys(spec.set), ...Object.keys(spec.skip)]);
}
