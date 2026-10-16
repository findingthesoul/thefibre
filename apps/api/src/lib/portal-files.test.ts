// The Files page's shape and order (Sjoerd 2ij), as a pure function: what is
// ADMITTED is decided upstream by the existing readers; this only groups.

import { describe, expect, it } from 'vitest';
import { groupFiles } from './portal-files.js';

const file = (id: string, title: string) => ({ id, title, path: `w/${id}.pdf`, mime: 'application/pdf', bytes: 10, uploaded_at: '2026-10-01T00:00:00Z' });
const link = (id: string, title: string) => ({ id, title, kind: 'link' as const, url: `https://example.com/${id}`, uploaded_at: '2026-10-01T00:00:00Z' });
const step = (title: string, url: string | null) => ({ title, url, sent_at: '2026-10-02T00:00:00Z' });

describe('groupFiles', () => {
  const out = groupFiles({
    workspaces: [
      { id: 'w-z', name: 'Zuid choir', logo_url: null },
      { id: 'w-a', name: 'Amsterdam circle', logo_url: 'https://x/logo.png' },
      { id: 'w-t', name: 'Thread only', logo_url: null },
    ],
    community: [
      { workspace_id: 'w-z', documents: [file('d2', 'Second'), link('d1', 'First link')] },
      { workspace_id: 'w-a', documents: [] },
    ],
    threads: [
      { workspace_id: 'w-z', thread_id: 't-b', thread_title: 'Bravo', items: [step('B1', 'https://example.com/b1')] },
      { workspace_id: 'w-z', thread_id: 't-a', thread_title: 'Alpha', items: [step('A1', 'https://example.com/a1'), step('A-unsafe', null)] },
      { workspace_id: 'w-t', thread_id: 't-x', thread_title: 'Only', items: [step('X1', 'https://example.com/x1')] },
      { workspace_id: 'w-a', thread_id: 't-n', thread_title: 'No safe links', items: [step('N', null)] },
    ],
  });

  it('communities by name; one with nothing admitted is left out', () => {
    expect(out.map((g) => g.name)).toEqual(['Thread only', 'Zuid choir']);
  });

  it('a community’s documents keep the admin’s order; files and links as they are', () => {
    const z = out.find((g) => g.workspace_id === 'w-z')!;
    expect(z.community.map((d) => d.title)).toEqual(['Second', 'First link']);
    expect(z.community[0]).toEqual({ id: 'd2', title: 'Second', kind: 'file', mime: 'application/pdf', bytes: 10 });
    // The storage path never leaves the server.
    expect(JSON.stringify(out)).not.toContain('w/d2.pdf');
  });

  it('threads by title; a step without a safe link is dropped', () => {
    const z = out.find((g) => g.workspace_id === 'w-z')!;
    expect(z.threads.map((t) => t.thread_title)).toEqual(['Alpha', 'Bravo']);
    expect(z.threads[0]!.items.map((i) => i.title)).toEqual(['A1']);
  });

  it('a place without a membership: thread groups only', () => {
    const t = out.find((g) => g.workspace_id === 'w-t')!;
    expect(t.community).toEqual([]);
    expect(t.threads).toHaveLength(1);
  });

  it('nothing in, nothing out', () => {
    expect(groupFiles({ workspaces: [], community: [], threads: [] })).toEqual([]);
  });
});
