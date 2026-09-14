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
      /** Where every person stands on this reading. */
      people: { person_id: string; rung: string }[];
    }
  | { ok: false; error: string };

export async function loadReading(axis: string): Promise<ReadingResult> {
  try {
    const r = await apiFetch<{
      bands: Band[];
      total: number;
      arrived: number;
      moved_total: number;
      since_days: number;
      people?: { person_id: string; rung: string }[];
    }>(`/api/v1/connections/landscape?since_days=30&axis=${encodeURIComponent(axis)}&people=1`);
    return {
      ok: true,
      bands: r.bands,
      total: r.total,
      arrived: r.arrived,
      movedTotal: r.moved_total,
      sinceDays: r.since_days,
      people: r.people ?? [],
    };
  } catch (e) {
    if (e instanceof ApiError) return { ok: false, error: `API ${e.status}` };
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
