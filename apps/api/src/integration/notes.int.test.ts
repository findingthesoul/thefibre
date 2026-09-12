// Notes that hang off a person, against real Postgres.
//
// The migration widened flow_run_note in place, which means it changed a
// table four external-app routes already write to. The risks worth a real
// database: that the widened RLS still admits a run-attached note, that the
// idempotency index actually prevents a duplicate, and that last_spoken_at
// counts the right kinds — a newsletter must not read as a conversation, or
// the attention conditions will call a dead relationship healthy.
//
// Staging only, throwaway workspace, fixtures cleaned by their own ids.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

let ws: string;
let personId: string;
const madeNotes: string[] = [];

async function note(fields: Record<string, unknown>) {
  const row = {
    workspace_id: ws,
    person_id: personId,
    body: 'said a thing',
    kind: 'note',
    origin: 'manual',
    is_draft: false,
    client_ref: randomUUID(),
    created_by: null,
    ...fields,
  };
  const { data, error } = await service.from('flow_run_note').insert(row).select('id').single();
  if (error) throw new Error(`note fixture: ${error.message}`);
  madeNotes.push(data!.id as string);
  return data!.id as string;
}

beforeAll(async () => {
  ws = await createThrowawayWorkspace('notes');
  const { data, error } = await service
    .from('person')
    .insert({ workspace_id: ws, first_name: 'Note', last_name: 'Subject' })
    .select('id')
    .single();
  if (error) throw new Error(`person fixture: ${error.message}`);
  personId = data!.id as string;
});

afterAll(async () => {
  if (madeNotes.length) await service.from('flow_run_note').delete().in('id', madeNotes);
  if (personId) await service.from('person').delete().eq('id', personId);
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('a note can hang off a person', () => {
  it('accepts a note with no flow run at all', async () => {
    // The whole point of the migration: before it, flow_run_id was NOT NULL,
    // so "I spoke to Marja" had nowhere to go unless Marja was on a flow.
    const id = await note({});
    const { data } = await service
      .from('flow_run_note')
      .select('flow_run_id, person_id, kind, origin, is_draft')
      .eq('id', id)
      .single();
    expect(data!.flow_run_id).toBeNull();
    expect(data!.person_id).toBe(personId);
  });

  it('refuses a note that is about nothing', async () => {
    // A row attached to neither a run, a person nor an organisation is the
    // shape a half-written client produces.
    const { error } = await service.from('flow_run_note').insert({
      workspace_id: ws,
      body: 'orphan',
      client_ref: randomUUID(),
    });
    expect(error).not.toBeNull();
    expect(error!.message).toMatch(/has_subject|violates check/i);
  });

  it('makes a retry harmless — the same client_ref cannot duplicate', async () => {
    // Autosave and offline replay are the same mechanism as idempotency:
    // every keystroke batch upserts the same row.
    const ref = randomUUID();
    await note({ client_ref: ref });
    const { error } = await service.from('flow_run_note').insert({
      workspace_id: ws,
      person_id: personId,
      body: 'the retry',
      client_ref: ref,
    });
    expect(error).not.toBeNull();
    expect(error!.code).toBe('23505');
  });

  it('lets historical rows without a client_ref coexist', async () => {
    // The unique index is partial; rows predating this migration have none
    // and must not collide with each other.
    const a = await note({ client_ref: null });
    const b = await note({ client_ref: null });
    expect(a).not.toBe(b);
  });
});

describe('last_spoken_at', () => {
  // Its OWN person. The structural fixtures above create notes dated now(),
  // and they are kind 'note' — a personal kind — so sharing a subject with
  // them made max(happened_at) today and every assertion below meaningless.
  // The first run of this file failed exactly that way.
  let subject: string;

  beforeAll(async () => {
    const { data, error } = await service
      .from('person')
      .insert({ workspace_id: ws, first_name: 'Cadence', last_name: 'Subject' })
      .select('id')
      .single();
    if (error) throw new Error(`cadence subject: ${error.message}`);
    subject = data!.id as string;
  });

  afterAll(async () => {
    await service.from('flow_run_note').delete().eq('person_id', subject);
    await service.from('person').delete().eq('id', subject);
  });

  it('counts a personal conversation', async () => {
    const when = '2026-06-01T10:00:00Z';
    await note({ kind: 'call', happened_at: when, person_id: subject });
    const { data, error } = await service.rpc('last_spoken_at', { p_person: subject });
    expect(error).toBeNull();
    expect(new Date(data as string).toISOString()).toBe(new Date(when).toISOString());
  });

  it('does NOT count a broadcast — a newsletter is not a conversation', async () => {
    // The decision this test exists to protect (D19): if a mailshot reset
    // the clock, the attention conditions would report a dead relationship
    // as healthy. A later email must not move last_spoken_at forward.
    await note({ kind: 'email', happened_at: '2026-09-01T10:00:00Z', person_id: subject });
    const { data } = await service.rpc('last_spoken_at', { p_person: subject });
    expect(new Date(data as string).toISOString()).toBe(
      new Date('2026-06-01T10:00:00Z').toISOString(),
    );
  });

  it('does NOT count a draft — an abandoned one is not a conversation either', async () => {
    await note({ kind: 'call', happened_at: '2026-09-05T10:00:00Z', is_draft: true, person_id: subject });
    const { data } = await service.rpc('last_spoken_at', { p_person: subject });
    expect(new Date(data as string).toISOString()).toBe(
      new Date('2026-06-01T10:00:00Z').toISOString(),
    );
  });

  it('returns null for somebody never spoken to', async () => {
    const { data: p } = await service
      .from('person')
      .insert({ workspace_id: ws, first_name: 'Never', last_name: 'Spoken' })
      .select('id')
      .single();
    const { data } = await service.rpc('last_spoken_at', { p_person: p!.id });
    expect(data).toBeNull();
    await service.from('person').delete().eq('id', p!.id);
  });
});
