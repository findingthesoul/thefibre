#!/usr/bin/env node
// Where does a bare `supabase db push` go from this checkout?
//
// The CLI remembers ONE linked project per checkout, in
// supabase/.temp/project-ref, and a bare `supabase db push` writes to it and
// reports success whatever it was meant for. The convention here is that the
// link RESTS on production: `scripts/db-push-staging.sh` links to staging,
// pushes, and puts it back; `scripts/db-push-prod.sh` links to production
// itself. So the resting state is checkable, and a link left on staging — a
// staging push interrupted before its restore, or a bare `supabase link` — is
// the hazard: the next bare push meant for production would hit staging and
// say it worked, and the schema would simply not be there at promote time.
//
// This is half of the guard. The other direction (a bare push meant for
// staging hitting production) has nothing to hang a check on; the rule for
// that is in docs/runway.md: migrations go through the two scripts, never a
// bare `supabase db push`.
//
// No link at all is fine: a fresh worktree has never run the CLI.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const PROD_REF = 'zfsyyokepyycefbxiblc';
export const STAGING_REF = 'lukhyylwhhjyihqtghvw';

/** @returns {{ ok: boolean, message: string }} */
export function checkLink(root) {
  const file = join(root, 'supabase/.temp/project-ref');
  if (!existsSync(file)) return { ok: true, message: 'supabase link: none in this checkout (nothing to check).' };
  const ref = readFileSync(file, 'utf8').trim();
  if (ref === PROD_REF) return { ok: true, message: `supabase link: rests on production (${PROD_REF}), as it should.` };
  const where = ref === STAGING_REF ? 'STAGING' : 'an unknown project';
  return {
    ok: false,
    message:
      `REFUSED: this checkout's Supabase CLI is linked to ${where} (${ref || 'empty'}), not production (${PROD_REF}).\n` +
      `  A bare \`supabase db push\` from here would write there and report success.\n` +
      `  A staging push was probably interrupted before it restored the link. Put it back:\n` +
      `      supabase link --project-ref ${PROD_REF}\n` +
      `  and push migrations only through ./scripts/db-push-staging.sh and ./scripts/db-push-prod.sh.`,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const { ok, message } = checkLink(root);
  (ok ? console.log : console.error)(message);
  process.exit(ok ? 0 : 1);
}
