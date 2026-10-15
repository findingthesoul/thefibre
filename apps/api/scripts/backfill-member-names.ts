// Give existing members the name they typed at the join — where the contact or
// the platform profile has none. Fill EMPTY only; never over a name.
//
// 2026-10-15: a member who joined soul.com had an existing, nameless contact;
// the join threw the typed name away (fixed in the same release:
// resolvePerson fillEmptyName), so my.thread → You showed blanks and the
// welcome mail said "Hi there". The name she typed is still on her purchases
// (payer_name) when she paid as herself.
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/backfill-member-names.ts prod                     # dry run, every community
//   npx tsx --env-file=.env scripts/backfill-member-names.ts prod --workspace soul    # one community
//   …add --apply to write.
//
// Per live member: the name source is the newest purchase they paid AS
// THEMSELVES (never a company's name: an organisation-paid invoice is named
// after the company), else the contact's own name for the profile. It fills
// person.first_name / last_name where empty (split like the join splits), and
// the platform profile (identity_profile.display_name, the seat's full_name)
// where empty — the same fill-empty rule the join now uses.

import { adminClient } from '../src/db.js';
import { splitPersonName } from '../src/lib/resolve-person.js';
import { fillEmptyPlatformName } from '../src/lib/identity-profile.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';
const args = process.argv.slice(2);
const target = args[0];
const apply = args.includes('--apply');
const wsSlug = args.includes('--workspace') ? args[args.indexOf('--workspace') + 1] : null;
if ((target !== 'prod' && target !== 'staging') || (args.includes('--workspace') && (!wsSlug || wsSlug.startsWith('--')))) {
  console.error('usage: npx tsx --env-file=<env> scripts/backfill-member-names.ts prod|staging [--workspace <slug>] [--apply]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

let wsFilter: string | null = null;
if (wsSlug) {
  const { data: ws } = await adminClient.from('workspace').select('id').eq('slug', wsSlug).maybeSingle();
  if (!ws) throw new Error(`workspace ${wsSlug} not found`);
  wsFilter = ws.id as string;
}

let q = adminClient
  .from('membership_member')
  .select('id, workspace_id, person:person_id (id, email, first_name, last_name)')
  .in('status', ['active', 'grace', 'past_due'])
  .is('deleted_at', null);
if (wsFilter) q = q.eq('workspace_id', wsFilter);
const { data: members, error } = await q;
if (error) throw new Error(`members: ${error.message}`);

console.log(`${target} · ${apply ? 'APPLYING' : 'dry run'} · ${(members ?? []).length} live member(s)${wsSlug ? ` in ${wsSlug}` : ''}\n`);
let filled = 0;
for (const m of members ?? []) {
  const p = (Array.isArray(m.person) ? m.person[0] : m.person) as { id: string; email: string | null; first_name: string | null; last_name: string | null } | null;
  if (!p?.email) continue;
  const { data: idp } = await adminClient.from('identity_profile').select('display_name').eq('email', p.email.toLowerCase()).maybeSingle();
  const personEmpty = !p.first_name?.trim() || !p.last_name?.trim();
  const platformEmpty = !(idp?.display_name as string | null)?.trim();
  if (!personEmpty && !platformEmpty) continue;

  // The name the member typed. NOT the Stripe customer's name on its own:
  // when an organisation pays, the join names the customer after the COMPANY
  // (membership-customer.ts invoiceName). So: the newest purchase this person
  // paid as THEMSELVES — payer not 'organisation', and a payer name that is
  // not the company on that invoice.
  let name: string | null = null;
  let source = '';
  const { data: pur } = await adminClient
    .from('purchase')
    .select('payer_name, billing')
    .eq('payer_email', p.email)
    .not('payer_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);
  for (const row of pur ?? []) {
    const bill = (row.billing ?? {}) as Record<string, unknown>;
    const pn = (row.payer_name as string | null)?.trim();
    if (!pn) continue;
    if (bill.payer === 'organisation') continue;
    if (typeof bill.company === 'string' && bill.company.trim().toLowerCase() === pn.toLowerCase()) continue;
    name = pn;
    source = 'own purchase';
    break;
  }
  if (!name && !personEmpty) {
    name = [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || null;
    source = 'contact';
  }
  if (!name) {
    console.log(`  · ${p.email}: no name anywhere — left as is`);
    continue;
  }
  const split = splitPersonName(name);
  const patch: Record<string, string> = {};
  if (split.first && !p.first_name?.trim()) patch.first_name = split.first;
  if (split.last && !p.last_name?.trim()) patch.last_name = split.last;
  const plan = [
    Object.keys(patch).length ? `contact ← ${JSON.stringify(patch)}` : null,
    platformEmpty ? `platform profile ← "${name}"` : null,
  ].filter(Boolean);
  if (!plan.length) continue;
  console.log(`  · ${p.email}: from ${source} "${name}" → ${plan.join('; ')}`);
  if (!apply) continue;
  if (Object.keys(patch).length) {
    const { error: upErr } = await adminClient.from('person').update(patch).eq('id', p.id);
    if (upErr) {
      console.log(`    ✗ contact update failed: ${upErr.message}`);
      continue;
    }
  }
  if (platformEmpty) await fillEmptyPlatformName(p.email, name);
  filled++;
}
console.log(`\n${apply ? `${filled} member(s) filled.` : 'Dry run — nothing changed. Add --apply to write.'}`);
