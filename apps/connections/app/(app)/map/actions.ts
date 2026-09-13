'use server';

// The reads the map makes after it has loaded: who is near a person, and who
// belongs to an organisation. Everything in a 'use server' module must be an
// async function, so only the types cross to the client.

import { apiFetch } from '@/lib/api';

export type Reason = { kind: 'stated' | 'tag' | 'organisation' | 'mentioned'; label: string };
export type Neighbour = { id: string; name: string; weight: number; reasons: Reason[] };
/** How two people ALREADY on screen are tied to each other. */
export type Link = { a: string; b: string; weight: number; reasons: Reason[] };
export type OrgRef = { id: string; name: string; title: string | null };
export type Member = { id: string; name: string; title: string | null };

export async function loadNeighbourhood(
  personId: string,
): Promise<
  { ok: true; neighbours: Neighbour[]; organisations: OrgRef[]; links: Link[] } | { ok: false; error: string }
> {
  // Never throws — the same rule as loadPerson, for the same reason: a
  // rejected server action skips every line after the await on the client,
  // and the map would sit on a spinner with no way out.
  try {
    const r = await apiFetch<{ neighbours: Neighbour[]; organisations?: OrgRef[]; links?: Link[] }>(
      `/api/v1/connections/map/${personId}/neighbourhood`,
    );
    return {
      ok: true,
      neighbours: r.neighbours ?? [],
      organisations: r.organisations ?? [],
      links: r.links ?? [],
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}

export async function loadOrganisation(
  orgId: string,
): Promise<
  { ok: true; organisation: { id: string; name: string }; members: Member[]; links: Link[] } | { ok: false; error: string }
> {
  try {
    const r = await apiFetch<{ organisation: { id: string; name: string }; members: Member[]; links?: Link[] }>(
      `/api/v1/connections/map/org/${orgId}`,
    );
    return { ok: true, organisation: r.organisation, members: r.members ?? [], links: r.links ?? [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
  }
}
