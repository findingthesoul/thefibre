// ---------------------------------------------------------------------------
// Run subject display helpers.
//
// Since Pulse opportunities mirror into flow_run (v0.13.114), a run's subject
// is no longer guaranteed to be a person: person_id is nullable and the row
// may instead carry an organisation and/or a free-text subject_label.
// Fallback chain everywhere: person name → organisation name → subject_label
// → 'Untitled'.
// ---------------------------------------------------------------------------

export type RunPerson = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type RunOrganisation = { id: string; name: string | null };

/** The subject-related fields any run row may carry (all optional so older
 *  payload shapes still typecheck). Supabase embeds can come back as arrays. */
export type RunSubject = {
  person?: RunPerson | RunPerson[] | null;
  organisation?: RunOrganisation | RunOrganisation[] | null;
  subject_label?: string | null;
  source_app?: string | null;
};

export function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

/** Display name for a bare person record (search results etc.). */
export function personDisplayName(p: RunPerson | null): string {
  if (!p) return 'Unknown';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown';
}

/** Display name for a run's subject: person → organisation → label → Untitled. */
export function runSubjectName(run: RunSubject): string {
  const person = one(run.person);
  if (person) {
    const n = [person.first_name, person.last_name].filter(Boolean).join(' ');
    if (n) return n;
    if (person.email) return person.email;
  }
  const org = one(run.organisation);
  if (org?.name) return org.name;
  if (run.subject_label) return run.subject_label;
  return 'Untitled';
}

/** Avatar initials for a run's subject, degrading like runSubjectName. */
export function runSubjectInitials(run: RunSubject): string {
  const person = one(run.person);
  if (person) {
    const i = (person.first_name?.[0] ?? '') + (person.last_name?.[0] ?? '');
    if (i) return i.toUpperCase();
    if (person.email?.[0]) return person.email[0].toUpperCase();
  }
  const name = runSubjectName(run);
  return name === 'Untitled' ? '?' : name[0].toUpperCase();
}

/** True when the run is mirrored from Fibre Pulse (stage changes sync both ways). */
export function isPulseRun(run: RunSubject): boolean {
  return run.source_app === 'fibre-pulse';
}

export const PULSE_BADGE_TITLE = 'mirrored from Fibre Pulse — stage changes sync both ways';
