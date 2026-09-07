// The free enrolment path, end to end against the STAGING API: a public
// visitor with no account enrols in a published thread → the platform
// auto-creates their person + account, records the enrolment, and the
// request is idempotent under retry (same request_id → same result, one
// row). This is the money path minus the money — the Stripe-card variant
// stays a supervised rehearsal on the rig (deliberately not automated).

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  cleanupPublicThreadFixture,
  createPublicThreadFixture,
  service,
  type PublicThreadFixture,
} from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let f: PublicThreadFixture;
const participantEmail = `int-enrolee-${randomUUID().slice(0, 8)}@example.com`;
const requestId = randomUUID();

async function enrol() {
  const r = await fetch(`${API}/api/v1/thread/public/enrol`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organiser_slug: f.organiserSlug,
      thread_slug: f.threadSlug,
      name: 'Int Enrolee',
      email: participantEmail,
      request_id: requestId,
      policy_accepted: true,
    }),
  });
  return { status: r.status, body: (await r.json()) as Record<string, unknown> };
}

beforeAll(async () => {
  f = await createPublicThreadFixture('enrol');
}, 60_000);

afterAll(async () => {
  if (f) await cleanupPublicThreadFixture(f, [participantEmail]);
}, 60_000);

describe('POST /thread/public/enrol — the free path', () => {
  it('enrols a stranger and records everything the data wall expects', async () => {
    const { status, body } = await enrol();
    expect(status, JSON.stringify(body)).toBe(201);
    expect(body.ok).toBe(true);
    // The enrol form's promise: an account exists to sign into ("Sign in
    // to your personal page") — auto-created, email-only.
    expect(body.has_account).toBe(true);

    // Oracle: the thread enrolment exists, tied to a person, free of
    // payment gating (no tickets → not_required).
    const { data: te, error: teErr } = await service
      .from('thread_enrolment')
      .select('id, payment_status, person_id')
      .eq('thread_id', f.threadId);
    expect(teErr).toBeNull();
    expect(te).toHaveLength(1);
    expect(te![0]!.payment_status).toBe('not_required');

    // The person materialised in the fixture workspace with the enrolee's
    // email, and is the one the enrolment points at.
    const { data: persons } = await service
      .from('person')
      .select('id')
      .eq('workspace_id', f.workspaceId)
      .eq('email', participantEmail);
    expect(persons).toHaveLength(1);
    expect(te![0]!.person_id).toBe(persons![0]!.id);

    // The platform enrolment (data-wall side) exists for the program.
    const { data: enr } = await service
      .from('enrolment')
      .select('id')
      .eq('program_id', f.programId);
    expect((enr ?? []).length).toBeGreaterThanOrEqual(1);
  });

  it('the same request_id replays idempotently — still exactly one row', async () => {
    const { status, body } = await enrol();
    expect(status).toBe(200);
    expect(body.idempotent).toBe(true);

    const { data: te } = await service
      .from('thread_enrolment')
      .select('id')
      .eq('thread_id', f.threadId);
    expect(te).toHaveLength(1);
  });

  it('a missing policy agreement is refused', async () => {
    const r = await fetch(`${API}/api/v1/thread/public/enrol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organiser_slug: f.organiserSlug,
        thread_slug: f.threadSlug,
        name: 'No Policy',
        email: `int-nopolicy-${randomUUID().slice(0, 6)}@example.com`,
        request_id: randomUUID(),
        policy_accepted: false,
      }),
    });
    expect(r.status).toBe(400);
  });
});
