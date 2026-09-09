// The public root namespace — app.thethread.app/{owner}.
//
// One URL segment resolves a workspace, a team OR a thread organiser
// (docs/brief-workspace-urls.md D3), so "is this slug free?" is one question
// asked of all three at once. `public_root_slug` holds the answer, kept in
// sync by triggers, with the slug as its primary key.
//
// The database is what actually enforces it. These helpers exist so a person
// who picks a taken address is told so in a sentence, at the moment they pick
// it, instead of meeting a constraint name — or, as happened on 2026-09-09,
// meeting nothing at all and finding two public pages 404 afterwards.
import { adminClient } from '../db.js';

export type RootSlugKind = 'workspace' | 'team' | 'organiser';

/** Who holds `slug`, if anyone. `except` lets a row keep its own slug when
 *  it is the one being updated. */
export async function rootSlugHolder(
  slug: string,
  except?: { teamId?: string | undefined; organiserId?: string | undefined },
): Promise<RootSlugKind | null> {
  const { data } = await adminClient
    .from('public_root_slug')
    .select('kind, team_id, organiser_id')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle();
  if (!data) return null;
  if (except?.teamId && data.team_id === except.teamId) return null;
  if (except?.organiserId && data.organiser_id === except.organiserId) return null;
  return data.kind as RootSlugKind;
}

/** The refusal, named by whoever is holding the address. */
export function slugTakenBy(kind: RootSlugKind): string {
  const owner =
    kind === 'workspace' ? 'a workspace' : kind === 'team' ? 'another team' : 'an organiser';
  return `that public address is already taken by ${owner} — pick another`;
}
