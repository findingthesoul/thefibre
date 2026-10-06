// An unpublished team has no public page.
//
// `team.is_published` was added on 2026-09-11 for exactly one reason: creating
// a "Finance" team so the bookkeeper can open Pulse should not also stand up a
// public page at app.thethread.app/finance. Nothing ever enforced it. Every
// public team lookup — the organiser/workspace/thread resolver in
// routes/thread.ts and Meet's three /public/team routes — matched on
// `is_active` alone, so every internal access group created in those five
// weeks served a public page carrying its name and description.
//
// Found 2026-10-06 while asking a different question: whether the automatic
// Admins and Everyone teams were safe to create on production. They would have
// stood up two public pages per workspace. They were not the cause; this was
// already true of every internal team.
//
// The flag went unenforced because a boolean nobody asserts is a comment. This
// test is the assertion.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createThrowawayWorkspace, deleteThrowawayWorkspace, service } from './staging.js';

const API = 'https://thefibre-api-staging.fly.dev';

let ws: string;
let publishedSlug: string;
let privateSlug: string;
const madeTeams: string[] = [];

beforeAll(async () => {
  ws = await createThrowawayWorkspace('unpub-team');
  const tag = randomUUID().slice(0, 8);
  publishedSlug = `int-pub-${tag}`;
  privateSlug = `int-priv-${tag}`;

  for (const [slug, published] of [
    [publishedSlug, true],
    [privateSlug, false],
  ] as const) {
    const { data, error } = await service
      .from('team')
      .insert({
        workspace_id: ws,
        name: published ? 'A public team' : 'An internal access group',
        description: 'Who may open which app — not for strangers to read.',
        slug,
        is_active: true,
        is_published: published,
      })
      .select('id')
      .single();
    if (error) throw new Error(`team fixture (${slug}): ${error.message}`);
    madeTeams.push(data!.id as string);
  }
});

afterAll(async () => {
  if (madeTeams.length) await service.from('team').delete().in('id', madeTeams);
  if (ws) await deleteThrowawayWorkspace(ws);
});

describe('an unpublished team is not public', () => {
  // The control. Without it, a resolver that 404s EVERYTHING would pass the
  // test below while taking every real team page down.
  it('a PUBLISHED team still resolves', async () => {
    const r = await fetch(`${API}/api/v1/thread/public/organiser/${publishedSlug}`);
    expect(r.status).toBe(200);
  });

  it('an UNPUBLISHED team 404s on the public owner route', async () => {
    const r = await fetch(`${API}/api/v1/thread/public/organiser/${privateSlug}`);
    expect(r.status).toBe(404);
  });

  it('and nothing in the response leaks its name or description', async () => {
    const r = await fetch(`${API}/api/v1/thread/public/organiser/${privateSlug}`);
    const body = await r.text();
    expect(body).not.toContain('An internal access group');
    expect(body).not.toContain('not for strangers to read');
  });

  it("Meet's public team route 404s for it too", async () => {
    const r = await fetch(`${API}/api/v1/meet/public/team/${privateSlug}`);
    expect(r.status).toBe(404);
  });
});
