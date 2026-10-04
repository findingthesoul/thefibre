// The one sentence every fixture write stands behind: THIS IS STAGING.
//
// The fixture account is made a platform super admin (so the pack can look at
// the admin screens without signing in as a real person), and it is given
// seeded purchases. Both are harmless on staging and unthinkable on
// production, so neither happens unless the project being written to is the
// staging one, by its ref — not "not production", which would wave through
// any third project somebody points an env file at.
//
// Pure and dependency-free, so the release gate can test it
// (scripts/e2e-identities.test.mjs).

export const STAGING_REF = 'lukhyylwhhjyihqtghvw';
export const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

/** Throws unless `url` is the staging Supabase project's own address. */
export function assertStagingProject(url: string | undefined | null, what: string): void {
  let host = '';
  try {
    host = new URL(String(url ?? '')).host;
  } catch {
    host = '';
  }
  if (host !== `${STAGING_REF}.supabase.co`) {
    const where = host.startsWith(`${PRODUCTION_REF}.`) ? 'PRODUCTION' : host || 'no project at all';
    throw new Error(
      `REFUSED: ${what} is for the staging project (${STAGING_REF}) only, and this client points at ${where}. Nothing was written.`,
    );
  }
}
