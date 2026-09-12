// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dequeueNote,
  fileNote,
  flushQueuedNotes,
  forgetLegacyPeople,
  queueNote,
  queuedNotes,
  unfiledNotes,
} from './offline-notes';

afterEach(() => localStorage.clear());

describe('the device queue', () => {
  it('keeps a note until it can be sent', () => {
    queueNote({ client_ref: 'a', body: 'spoke with wilma' });
    expect(queuedNotes()).toHaveLength(1);
  });

  it('stores ONE entry per note, its newest version', () => {
    // A note edited three times offline must replay once, as its latest text.
    // Replaying an older draft after a newer commit is the classic offline
    // bug, and keying by client_ref makes it impossible rather than guarded.
    queueNote({ client_ref: 'a', body: 'first', is_draft: true });
    queueNote({ client_ref: 'a', body: 'second', is_draft: true });
    queueNote({ client_ref: 'a', body: 'final', is_draft: false });
    const q = queuedNotes();
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({ body: 'final', is_draft: false });
  });

  it('keeps separate notes separate', () => {
    queueNote({ client_ref: 'a', body: 'about wilma' });
    queueNote({ client_ref: 'b', body: 'about joost' });
    expect(queuedNotes()).toHaveLength(2);
  });

  it('forgets a note once it is sent', () => {
    queueNote({ client_ref: 'a', body: 'x' });
    dequeueNote('a');
    expect(queuedNotes()).toHaveLength(0);
  });

  it('skips a corrupt entry instead of losing every other note', () => {
    queueNote({ client_ref: 'good', body: 'kept' });
    localStorage.setItem('connections:offline-note:bad', '{not json');
    expect(queuedNotes().map((n) => n.client_ref)).toEqual(['good']);
  });
});

describe('sending what is waiting', () => {
  it('sends every queued note and removes the ones that landed', async () => {
    queueNote({ client_ref: 'a', person_id: 'p1', body: 'one' });
    queueNote({ client_ref: 'b', person_id: 'p1', body: 'two' });
    const save = vi.fn(async () => ({ ok: true }));
    const stuck = await flushQueuedNotes(save);
    expect(save).toHaveBeenCalledTimes(2);
    expect(stuck).toBe(0);
    expect(queuedNotes()).toHaveLength(0);
  });

  it('keeps a note that still cannot be sent, and reports it', async () => {
    queueNote({ client_ref: 'a', person_id: 'p1', body: 'still offline' });
    const stuck = await flushQueuedNotes(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(stuck).toBe(1);
    expect(queuedNotes()).toHaveLength(1);
  });

  it('keeps a note the server refused, rather than dropping it', async () => {
    queueNote({ client_ref: 'a', person_id: 'p1', body: 'refused' });
    const stuck = await flushQueuedNotes(async () => ({ ok: false }));
    expect(stuck).toBe(1);
    expect(queuedNotes()).toHaveLength(1);
  });

  it('sends notes in the order they were written', async () => {
    // The activity row and the follow-up task a commit creates should land in
    // the order the conversations happened.
    queueNote({ client_ref: 'first', person_id: 'p1', body: '1' });
    await new Promise((r) => setTimeout(r, 5));
    queueNote({ client_ref: 'second', person_id: 'p1', body: '2' });
    const order: string[] = [];
    await flushQueuedNotes(async (p) => {
      order.push(p.client_ref);
      return { ok: true };
    });
    expect(order).toEqual(['first', 'second']);
  });
});

describe('a note written offline with only a name', () => {
  it('is not sent while nobody has said who it is about', async () => {
    // Sending it would ask the server to match a name, which system-handbook
    // §12 forbids. It waits, and counts as stuck.
    queueNote({ client_ref: 'a', person_name: 'Wilma', body: 'spoke about the retreat' });
    const save = vi.fn(async () => ({ ok: true }));
    const stuck = await flushQueuedNotes(save);
    expect(save).not.toHaveBeenCalled();
    expect(stuck).toBe(1);
    expect(unfiledNotes()).toEqual([
      { client_ref: 'a', person_name: 'Wilma', body: 'spoke about the retreat' },
    ]);
  });

  it('is sent once a person is chosen, without the typed name', async () => {
    // The twin of the case above.
    queueNote({ client_ref: 'a', person_name: 'Wilma', body: 'spoke about the retreat' });
    expect(fileNote('a', 'p1')).toBe(true);
    expect(unfiledNotes()).toHaveLength(0);
    const sent: Record<string, unknown>[] = [];
    const stuck = await flushQueuedNotes(async (p) => {
      sent.push(p);
      return { ok: true };
    });
    expect(stuck).toBe(0);
    expect(sent[0]).toMatchObject({ client_ref: 'a', person_id: 'p1', body: 'spoke about the retreat' });
    expect(sent[0]).not.toHaveProperty('person_name');
  });

  it('keeps the workspace it was written in when filed', () => {
    localStorage.setItem('connections:workspace', 'ws1');
    queueNote({ client_ref: 'a', person_name: 'Wilma', body: 'x' });
    fileNote('a', 'p1');
    expect(queuedNotes('ws1')).toHaveLength(1);
    expect(queuedNotes('ws2')).toHaveLength(0);
  });

  it('cannot file a note that is not there', () => {
    expect(fileNote('missing', 'p1')).toBe(false);
  });
});

describe('the people list older versions kept', () => {
  it('is removed from the device', () => {
    localStorage.setItem('connections:people', JSON.stringify({ workspaceId: 'ws1', people: [{ id: 'p', name: 'Wilma' }] }));
    forgetLegacyPeople();
    expect(localStorage.getItem('connections:people')).toBeNull();
  });

  it('removes nothing else', () => {
    queueNote({ client_ref: 'a', person_id: 'p1', body: 'kept' });
    forgetLegacyPeople();
    expect(queuedNotes()).toHaveLength(1);
  });
});
