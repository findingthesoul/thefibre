// Local shapes for the projects surface.

export type InvolvedTeam = {
  id: string;
  team_id: string;
  // team embeds can come back as object OR single-element array from PostgREST.
  team: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type Project = {
  id: string;
  name: string;
  team_id: string | null;
  notes: string | null;
};

// `fallback` = the localized "Unnamed team" (i18n P3) — callers pass
// t(locale, 'unnamed_team'); the default keeps old call sites working.
export function teamName(t: InvolvedTeam['team'], fallback = 'Unnamed team'): string {
  const one = Array.isArray(t) ? t[0] : t;
  return one?.name ?? fallback;
}
