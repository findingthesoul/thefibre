// Are refunds with credit notes behaving? (refund rules, slices 3a + 3b;
// written for the first live refunds after batch 41, 2026-10-17). Sjoerd runs
// this against PRODUCTION in his own terminal:
//
//   cd apps/api
//   npx tsx --env-file=.env scripts/credit-notes-check.ts prod [days]
//   npx tsx --env-file=.env.staging scripts/credit-notes-check.ts staging [days]
//
// For every credit note of the last `days` (default 7), and for its purchase,
// the things that must hold — each line says OK or what is wrong:
//   · net + VAT = what the note credits (the table's own CHECK; read back);
//   · the purchase's notes add up to no more than was paid;
//   · a purchase whose notes reach what was paid reads 'refunded', and one
//     that does not, still reads 'paid';
//   · the member was emailed (emailed_at), unless the note is under 5 minutes
//     old;
//   · a refund note carries its Stripe refund id;
//   · when the purchase has a Stripe invoice, the note is Stripe's (its id),
//     numbered in that invoice's series.
//
// Numbers, amounts and ids only: no names, no addresses. It writes NOTHING.
// What it cannot see is in the API log — the one-line companion is printed at
// the end.

import { adminClient } from '../src/db.js';

const STAGING_REF = 'lukhyylwhhjyihqtghvw';
const PRODUCTION_REF = 'zfsyyokepyycefbxiblc';

const target = process.argv[2];
const days = Number(process.argv[3] ?? 7);
if ((target !== 'prod' && target !== 'staging') || !Number.isFinite(days) || days <= 0) {
  console.error('usage: npx tsx --env-file=<env> scripts/credit-notes-check.ts prod|staging [days]');
  process.exit(64);
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
if (!url.includes(target === 'prod' ? PRODUCTION_REF : STAGING_REF)) {
  console.error(`REFUSED: you said ${target}, but the env file points at ${url || 'nothing'}.`);
  process.exit(2);
}

type Note = {
  id: string;
  purchase_id: string;
  number: string;
  amount_cents: number;
  net_cents: number;
  vat_cents: number;
  vat_rate: number | null;
  currency: string;
  kind: string;
  platform_fee_refunded_cents: number;
  rule_pct: number | null;
  stripe_refund_id: string | null;
  stripe_credit_note_id: string | null;
  emailed_at: string | null;
  created_at: string;
};
type Purchase = { id: string; amount_cents: number; status: string; stripe_invoice_id: string | null; billing: { number?: string | null } | null };

const since = new Date(Date.now() - days * 86_400_000).toISOString();
const { data: recent, error } = await adminClient
  .from('purchase_credit_note')
  .select('id, purchase_id, number, amount_cents, net_cents, vat_cents, vat_rate, currency, kind, platform_fee_refunded_cents, rule_pct, stripe_refund_id, stripe_credit_note_id, emailed_at, created_at')
  .gte('created_at', since)
  .order('created_at');
if (error) {
  console.error(`could not read credit notes: ${error.message}`);
  process.exit(1);
}
const notes = (recent ?? []) as Note[];
console.log(`${target}: ${notes.length} credit note(s) in the last ${days} day(s).`);
if (!notes.length) {
  console.log('Nothing to check yet — no refund has made a credit note in that window.');
  process.exit(0);
}

const purchaseIds = [...new Set(notes.map((n) => n.purchase_id))];
const { data: ps, error: pErr } = await adminClient.from('purchase').select('id, amount_cents, status, stripe_invoice_id, billing').in('id', purchaseIds);
// ALL notes of those purchases, not only the recent ones: "within what was paid" is about every note.
const { data: all, error: aErr } = await adminClient.from('purchase_credit_note').select('purchase_id, amount_cents').in('purchase_id', purchaseIds);
if (pErr || aErr) {
  console.error(`could not read purchases: ${(pErr ?? aErr)!.message}`);
  process.exit(1);
}
const purchases = new Map(((ps ?? []) as Purchase[]).map((p) => [p.id, p]));
const credited = new Map<string, number>();
for (const n of (all ?? []) as { purchase_id: string; amount_cents: number }[]) credited.set(n.purchase_id, (credited.get(n.purchase_id) ?? 0) + n.amount_cents);

const money = (c: number, cur: string) => `${cur} ${(c / 100).toFixed(2)}`;
let problems = 0;
for (const n of notes) {
  const p = purchases.get(n.purchase_id);
  const wrong: string[] = [];
  if (n.net_cents + n.vat_cents !== n.amount_cents) wrong.push(`net ${n.net_cents} + VAT ${n.vat_cents} ≠ ${n.amount_cents}`);
  if (!p) wrong.push('its purchase is not readable');
  else {
    const total = credited.get(p.id) ?? 0;
    if (total > p.amount_cents) wrong.push(`notes credit ${total}, more than the ${p.amount_cents} paid`);
    if (total >= p.amount_cents && p.status !== 'refunded') wrong.push(`fully credited but the purchase reads '${p.status}'`);
    if (total < p.amount_cents && p.status === 'refunded') wrong.push(`only ${total} of ${p.amount_cents} credited but the purchase reads 'refunded'`);
    if (p.stripe_invoice_id && n.kind === 'refund') {
      if (!n.stripe_credit_note_id) wrong.push('the purchase has a Stripe invoice but the note is not Stripe’s (our own series was used — see the log)');
      else if (p.billing?.number && !n.number.startsWith(`${p.billing.number}-CN-`)) wrong.push(`number ${n.number} is not in the invoice's series ${p.billing.number}`);
    }
  }
  if (n.kind === 'refund' && !n.stripe_refund_id) wrong.push('no Stripe refund id');
  const ageMin = (Date.now() - Date.parse(n.created_at)) / 60_000;
  if (!n.emailed_at && ageMin >= 5) wrong.push(`not emailed (${Math.round(ageMin)} min old)`);

  const line = [
    n.created_at.slice(0, 16).replace('T', ' '),
    n.number,
    money(n.amount_cents, n.currency),
    n.vat_cents ? `incl. VAT ${money(n.vat_cents, n.currency)}${n.vat_rate !== null ? ` (${n.vat_rate}%)` : ''}` : 'no VAT',
    n.rule_pct !== null ? `rule ${n.rule_pct}%` : 'set by hand',
    `fee back ${money(n.platform_fee_refunded_cents, n.currency)}`,
    p ? `purchase ${p.id.slice(0, 8)} ${p.status} (${money(credited.get(p.id) ?? 0, n.currency)} of ${money(p.amount_cents, n.currency)})` : '',
    n.stripe_credit_note_id ? 'Stripe note' : 'our series',
    n.emailed_at ? 'emailed' : 'not emailed',
  ].join(' · ');
  console.log(`${wrong.length ? 'PROBLEM' : 'OK     '} ${line}`);
  for (const w of wrong) console.log(`          → ${w}`);
  problems += wrong.length ? 1 : 0;
}
console.log(problems ? `\n${problems} note(s) need a look.` : '\nEvery note checks out.');
console.log(
  `\nThe log is the other half (a refund the database refused to record shows only there):\n` +
    `  fly logs -a ${target === 'prod' ? 'thefibre-api' : 'thefibre-api-staging'} --no-tail | grep -E "REFUND-UNRECORDED|credit note (pdf|email) failed|platform fee returned differs|credit note on Stripe failed"`,
);
process.exit(problems ? 1 : 0);
