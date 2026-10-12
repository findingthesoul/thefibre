#!/usr/bin/env node
//
// Which workspaces carry `zoom_notice_hidden`? Prints `name=<name> (<slug>)`
// per workspace, or `error=<why>`, for batch-prod.sh's preflight gate.
//
// It NAMES them rather than answering yes/no, because "some workspace has the
// flag" is a weaker fact than it looks: it is satisfied by a flag set on the
// wrong workspace by mistake. What the person running the sitting confirms is
// "yes, that is the reviewer's", not "something matched".
//
// Nothing on stdout when none are flagged, so the gate's test is simply
// whether a `name=` line came back. A FAILED LOOKUP prints `error=` and the
// gate treats it differently: "nobody looked" is not "none flagged", and
// reporting one as the other sends somebody to set a flag already there.
//
// Lives here rather than in scripts/ because only apps/api can resolve
// @supabase/supabase-js, and it uses the one env reader the other scripts in
// this directory use.
//
// REMOVE WHEN THE ZOOM MARKETPLACE APP IS PUBLISHED, together with the gate
// in scripts/batch-prod.sh, src/lib/zoom-pending.ts and the column.

import { createClient } from '@supabase/supabase-js';
import { loadEnv } from './lib/env.mjs';

const envFile = process.env.FIBRE_ENV_FILE ?? '.env';

let env;
try {
  ({ env } = loadEnv(envFile));
} catch (e) {
  console.log(`error=cannot read apps/api/${envFile}: ${e.message}`);
  process.exit(0);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.log(`error=apps/api/${envFile} has no Supabase credentials`);
  process.exit(0);
}

const db = createClient(url, key, { auth: { persistSession: false } });
const { data, error } = await db
  .from('workspace')
  .select('name, slug')
  .eq('zoom_notice_hidden', true);

if (error) {
  console.log(`error=${error.message}`);
  process.exit(0);
}

// An explicit answer for "looked, found none". Silence cannot carry it: a
// crash is also silent on stdout, and the gate must not read a broken lookup
// as a true negative — that sends somebody to set a flag which may already be
// set, and leaves a real tooling fault undiagnosed.
if (!data?.length) {
  console.log('none');
} else {
  for (const w of data) console.log(`name=${w.name} (${w.slug})`);
}
