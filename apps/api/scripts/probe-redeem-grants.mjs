// Is `redeem_discount_code` really closed to everybody but the service role?
//
//   FIBRE_ENV_FILE=…/.env.staging node apps/api/scripts/probe-redeem-grants.mjs
//
// The migration revokes the function from PUBLIC, anon and authenticated, and
// grants it to service_role alone — definer functions are born closed in this
// codebase (2026-09-14). A REVOKE that was written but never reached (a typo
// in a role name does not error) looks exactly like one that worked, so this
// asks the database from each side.
//
// It takes one use of a code when called with the service role, so it runs
// against a throwaway code it creates and removes. Staging only.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const envFile = process.env.FIBRE_ENV_FILE;
if (!envFile) {
  console.error('set FIBRE_ENV_FILE to the staging env file');
  process.exit(2);
}
const raw = readFileSync(envFile, 'utf8');
const env = Object.fromEntries(
  raw
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
if (!url.includes('lukhyylwhhjyihqtghvw')) throw new Error('refusing: not the staging project');

const service = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});


// A DENIAL FOR THE WRONG REASON IS NOT A DENIAL. The first run of this probe
// printed "closed to everyone but the service role" while both calls had
// actually failed with "Invalid API key" — the env file it was pointed at
// carried a stale anon key, so nothing had been asked of the grant at all.
// That is the same trap as an empty list reading as a working one, in the one
// place where a false pass is worst: a security check.
const PERMISSION = /permission denied|not authorized|must be owner/i;
const judge = (who, error, data) => {
  if (!error) return { ok: false, line: `${who} OPEN — returned ${data}` };
  if (PERMISSION.test(error.message)) return { ok: true, line: `${who} DENIED: ${error.message}` };
  return {
    ok: false,
    line: `${who} INCONCLUSIVE: ${error.message} — this is not a permission denial, so the grant was never tested (check the key in FIBRE_ENV_FILE)`,
  };
};

// A throwaway workspace would need the whole fixture apparatus; a code needs
// only a workspace id, so it borrows one and is deleted in the finally.
const { data: ws } = await service.from('workspace').select('id').limit(1).single();
const { data: made, error: mErr } = await service
  .from('discount_code')
  .insert({
    workspace_id: ws.id,
    code: `GRANT-PROBE-${Date.now()}`,
    type: 'free',
    applies_to: 'workspace',
    usage_limit: 5,
  })
  .select('id')
  .single();
if (mErr) throw new Error(`could not create the probe code: ${mErr.message}`);

let bad = 0;
try {
  // 1. anon — the key a browser carries.
  {
    const { data, error } = await anon.rpc('redeem_discount_code', { p_code_id: made.id });
    const r = judge('anon         ', error, data);
    if (!r.ok) bad += 1;
    console.log(`  ${r.line}`);
  }

  // 2. authenticated — a real signed-in user's JWT, not the anon key with a
  //    different label. A fixture address, created and removed here.
  {
    const email = `int-grant-probe-${Date.now()}@example.com`;
    const { error: cErr } = await service.auth.admin.createUser({ email, email_confirm: true });
    if (cErr) throw new Error(`fixture user: ${cErr.message}`);
    const { data: link } = await service.auth.admin.generateLink({ type: 'magiclink', email });
    const scratch = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    let v = await scratch.auth.verifyOtp({
      type: 'magiclink',
      token_hash: link.properties.hashed_token,
    });
    if (v.error) {
      v = await scratch.auth.verifyOtp({ type: 'email', token_hash: link.properties.hashed_token });
    }
    const token = v.data?.session?.access_token;
    if (!token) throw new Error('could not mint an authenticated session');
    const asUser = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data, error } = await asUser.rpc('redeem_discount_code', { p_code_id: made.id });
    const r = judge('authenticated', error, data);
    if (!r.ok) bad += 1;
    console.log(`  ${r.line}`);

    const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    const u = users?.users?.find((x) => x.email === email);
    if (u) await service.auth.admin.deleteUser(u.id);
  }

  // 3. And the positive anchor: the one role that MAY must actually be able
  //    to. Two denials prove nothing if the function is broken for everyone.
  {
    const { data, error } = await service.rpc('redeem_discount_code', { p_code_id: made.id });
    const worked = !error && data !== null;
    if (!worked) bad += 1;
    console.log(
      `  service_role  ${worked ? `allowed — used_count is now ${data}` : `REFUSED: ${error?.message ?? 'no row'}`}`,
    );
  }
} finally {
  await service.from('discount_code').delete().eq('id', made.id);
  console.log('  (probe code removed)');
}

console.log(bad === 0 ? '\nclosed to everyone but the service role.' : `\n${bad} probe(s) went the wrong way.`);
process.exit(bad === 0 ? 0 : 1);
