'use server';

// One reading of the landscape, with everybody's place on it.
//
// The column browser needs, for a reading: its steps with their counts, and
// which step each person is on — so that picking a step can list its people
// without a second request. The API already returns exactly that when asked
// with `people=1`; this is the server-side call the client component cannot
// make itself (apiFetch reads the session cookie).
//
// Never throws, for the reason every action in this app gives: a rejected
// call skips the line that clears the loading state.

import { apiFetch, ApiError } from '@/lib/api';
import type { Band } from './axes';

export type ReadingResult =
  | {
      ok: true;
      bands: Band[];
      total: number;
      arrived: number;
      movedTotal: number;
      sinceDays: number;
      /**
       * Where every person stands on this reading, and where they stood at the
       * start of the period — null when they did not exist yet.
       */
      people: { person_id: string; rung: string; was: string | null }[];
    }
  | { ok: false; error: string };

export async function loadReading(axis: string, sinceDays = 30): Promise<ReadingResult> {
  try {
    const r = await apiFetch<{
      bands: Band[];
      total: number;
      arrived: number;
      moved_total: number;
      since_days: number;
      people?: { person_id: string; rung: string; was?: string | null }[];
    }>(
      `/api/v1/connections/landscape?since_days=${sinceDays}&axis=${encodeURIComponent(axis)}&people=1`,
    );
    return {
      ok: true,
      bands: r.bands,
      total: r.total,
      arrived: r.arrived,
      movedTotal: r.moved_total,
      sinceDays: r.since_days,
      // `was` is newer than the page that first read this; an API that has not
      // shipped it yet reads as nobody having moved, never as a crash.
      people: (r.people ?? []).map((x) => ({ ...x, was: x.was ?? null })),
    };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `API ${e.status}` };
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

export type Facet = {
  person_id: string;
  tags: string[];
  /** City when known, otherwise the country. */
  location: string | null;
  /** Current organisations only. */
  companies: string[];
};

export type FacetsResult = { ok: true; people: Facet[] } | { ok: false; error: string };

/**
 * What each person can be grouped by — tag, location, company.
 *
 * Sjoerd, 2026-09-14: *"maybe there could be sub categories (extra column)
 * like tag, location, company"*. Loaded once for the workspace; the board
 * groups in the browser, so changing the group never waits on the server.
 */
export async function loadFacets(): Promise<FacetsResult> {
  try {
    const r = await apiFetch<{ people: Facet[] }>('/api/v1/connections/facets');
    return { ok: true, people: r.people ?? [] };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `API ${e.status}` };
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
