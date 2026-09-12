'use server';

// The one read the map makes after it has loaded: who is near a person.
// Everything in a 'use server' module must be an async function, so only the
// types cross to the client.

import { apiFetch } from '@/lib/api';

export type Reason = { kind: 'stated' | 'tag' | 'organisation' | 'mentioned'; label: string };
export type Neighbour = { id: string; name: string; weight: number; reasons: Reason[] };

export async function loadNeighbourhood(
  personId: string,
): Promise<{ ok: true; neighbours: Neighbour[] } | { ok: false; error: string }> {
  // Never throws — the same rule as loadPerson, for the same reason: a
  // rejected server action skips every line after the await on the client,
  // and the map would sit on a spinner with no way out.
  try {
    const r = await apiFetch<{ neighbours: Neighbour[] }>(
      `/api/v1/connections/map/${personId}/neighbourhood`,
    );
    return { ok: true, neighbours: r.neighbours ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
