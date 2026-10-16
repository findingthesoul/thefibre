import { Hono, type Context } from 'hono';
import { fillEmptyPlatformName } from '../lib/identity-profile.js';
import { z } from 'zod';
import { announceHeld, dismissHeld, heldThreads } from '../lib/member-notify.js';
import { GRANT_THREAD_PROBLEM, resolveGrantThread } from '../lib/thread-grant.js';
import {
  addDocument,
  addLink,
  communityView,
  isLink,
  readMemberPage,
  removeDocument,
  renameDocument,
  reorderDocuments,
  saveIntro,
  saveTierIntro,
  setDocumentTiers,
} from '../lib/member-page.js';
import {
  parseFibreSeatConfig,
  parseTeamCalendarConfig,
  teamIsInWorkspace,
} from '../lib/grant-config.js';
import { setDirectoryListing } from '../lib/directory-consent.js';
import { resolveTerms } from '../lib/terms.js';
import { participantEmailFromAuth } from '../lib/participant-auth.js';
import {
  discountedPrice,
  findDiscountCode,
  redeemDiscountCode,
} from '../lib/discount-codes.js';
import { periodLastDay } from '@thefibre/shared/membership-period';
import { clientIp, hit, isExhausted, resetSecondsFor } from '../lib/rate-limit.js';
import { isStorableCode } from '../lib/like-escape.js';
import { BillingFields } from '../lib/billing-fields.js';
import {
  billingMetadata,
  customerForJoin,
  readBillingMetadata,
} from '../lib/membership-customer.js';
import { fixedFirstPeriod } from '@thefibre/shared/fixed-renewal';
import type Stripe from 'stripe';
import { userClient, adminClient } from '../db.js';
import { organisationBilling, organisationBillingSnapshot } from '../lib/org-billing.js';
import { resolvePerson } from '../lib/resolve-person.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { workspaceStripeAccount } from '../lib/payment-accounts.js';
import { invoiceLines } from '../lib/invoice-lines.js';
import { sanitizeRichText } from '../lib/rich-text.js';
import { actorUserId } from '../middleware/app-context.js';
import { memberNotifyDigest } from '../lib/email/member-notify-templates.js';
import { communityWords, EMAIL_IMAGE_BUCKET, emailImageUrl, fillTemplate, memberEmailValues } from '../lib/member-email-templates.js';
import { recordPurchase } from '../lib/purchases.js';
import { chargeNet, saleVat, type SaleVat } from '../lib/sale-vat.js';
import { connectedTaxRateId } from '../lib/vat-stripe.js';
import { resolveSellerVat } from '../lib/seller-vat.js';
// Half of a deliberate import cycle — see the note above the matching
// import in routes/purchases.ts. sendReceipt must stay a hoisted `function`
// declaration, not a const arrow, or the cycle stops being harmless.
import { sendReceipt } from './purchases.js';
import { createMembershipPaymentLink, payButtonHtml } from '../lib/membership-payment-link.js';
import { sendEmail } from '../lib/email/client.js';
import { getWorkspaceBrand, senderOf } from '../lib/workspace-brand.js';
import { shell, escapeHtml } from '../lib/email/templates.js';
import {
  membershipWelcome,
  membershipRenewalReminder,
  membershipPaymentFailed,
  membershipLapsed,
} from '../lib/email/membership-templates.js';
import { appUrl, LOCALES, isLocale, toLocale, type Locale } from '@thefibre/shared';
import { stackSurfaceUrl } from '../lib/stack-urls.js';
import { LINK_KINDS } from '@thefibre/shared/link-kinds';
import { runCircleAccessSync } from '../lib/circle.js';
import { runGoogleUserSync } from '../lib/google-admin.js';
import { runThreadAccessSync } from '../lib/thread-access.js';
import { teamCalendarNamesFor } from '../lib/member-discount.js';
import { effectiveInterval } from '../lib/membership-interval.js';
import {
  applyPct,
  evaluatePriceLogic,
  priceLogicFor,
  type PriceLogic,
} from '../lib/pricing.js';
import { runFibreSeatSync, grantSeat } from '../lib/fibre-seat.js';

// ===========================================================================
// Fibre Membership — the community-subscription API.
//
// A workspace sells tiered recurring memberships to its community.
// docs/membership-proposal.md is the spec (D1–D6 accepted 2026-09-04).
//
// System-of-record rule (§3.8): member.status is written HERE (and by the
// Stripe webhook / scheduler via service role) — Flow reacts to the activity
// events, it never owns the lifecycle.
//
// RLS does the heavy lifting: catalogue reads for anyone in the workspace
// with the app, writes admin-only, members visible workspace-wide with the
// app. Every human-session query runs through userClient(jwt). Full
// Postgres errors go to stderr (feedback_api_logs_first).
// ===========================================================================

export const membershipRoutes = new Hono();

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const Characteristics = z.array(z.string().min(1).max(300)).max(30);

const CreateTier = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  characteristics: Characteristics.optional(),
  price_cents_year: z.number().int().min(0).optional().nullable(),
  price_cents_month: z.number().int().min(0).optional().nullable(),
  currency: z.string().length(3).default('EUR'),
  // The launch cohort's one date: a plain yyyy-mm-dd, or null for ordinary
  // anniversary billing. Validated as a date rather than a free string so a
  // typo cannot reach the join route and silently do nothing.
  first_period_ends_on: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'use a date like 2026-12-31')
    .optional()
    .nullable(),
  sort_order: z.number().int().optional(),
  /** Not listed on the public join page, still joinable by direct link
   *  (2026-10-14). Distinct from `archived`: hidden sells normally and
   *  renews normally, it is simply not advertised. */
  hidden: z.boolean().optional(),
  // "Price includes VAT" (2026-10-16): the entered year/month price is what a
  // home-rate buyer pays; ignored unless the community is VAT-registered.
  price_includes_vat: z.boolean().optional(),
});
const PatchTier = CreateTier.partial().extend({
  archived: z.boolean().optional(),
});

const LinkKind = z.enum(LINK_KINDS);
const CreateProduct = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(4000).optional().nullable(),
  characteristics: Characteristics.optional(),
  price_cents: z.number().int().min(0).optional().nullable(),
  // 'once' bills on the first invoice; 'month'/'year' ride the member's
  // subscription when the interval matches the tier's ('week' reserved).
  price_interval: z.enum(['once', 'week', 'month', 'year']).optional(),
  currency: z.string().length(3).default('EUR'),
  links: z
    .array(z.object({ kind: LinkKind, ref: z.string().min(1).max(500), label: z.string().max(200).optional() }))
    .max(30)
    .optional(),
  // À-la-carte (2026-09-06): standalone selling is an EXPLICIT setting, not
  // inferred from price — a priced product can still be tier-only.
  purchasable: z.boolean().optional(),
  price_includes_vat: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});
const PatchProduct = CreateProduct.partial().extend({
  archived: z.boolean().optional(),
  // The product group it is listed under (2026-10-16); null = none.
  group_id: z.string().uuid().nullable().optional(),
});

const MemberStatus = z.enum(['active', 'grace', 'lapsed', 'cancelled']);
const CreateMember = z
  .object({
    // Exactly one of person_id / organisation_id (§3.5 v1): an org
    // membership is a membership_member row with organisation_id set and
    // person_id NULL; its people occupy seats (see /members/:id/seats).
    person_id: z.string().uuid().optional(),
    organisation_id: z.string().uuid().optional(),
    seat_allowance: z.number().int().min(1).max(10000).optional(),
    tier_id: z.string().uuid(),
    status: MemberStatus.default('active'),
    started_at: z.string().datetime().optional(),
    renews_at: z.string().datetime().optional().nullable(),
    notes: z.string().max(4000).optional().nullable(),
    // Manual add = usually the INVOICED case (Sjoerd, 2026-09-05): 'invoice'
    // creates a pending ledger invoice (tier price × pricing rules) and
    // emails it; 'comped' is free and quiet. country feeds the pricing
    // rules; invite sends the sign-in email for the member portal.
    // For ORG memberships: country/invite are person concepts and ignored;
    // 'invoice' bills the ORGANISATION (tier price × seats, org_billing
    // contact). NO Stripe subscription for orgs in v1 — deliberate.
    country: z.string().regex(/^[A-Za-z]{2}$/).optional().nullable(),
    billing: z.enum(['comped', 'invoice']).default('comped'),
    interval: z.enum(['year', 'month']).default('year'),
    invite: z.boolean().default(false),
  })
  .refine((v) => Boolean(v.person_id) !== Boolean(v.organisation_id), {
    message: 'exactly one of person_id or organisation_id',
  })
  .refine((v) => !v.seat_allowance || v.organisation_id, {
    message: 'seat_allowance only applies to organisation memberships',
  });
const PatchMember = z.object({
  tier_id: z.string().uuid().optional(),
  status: MemberStatus.optional(),
  renews_at: z.string().datetime().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  // Self-declared country — a DELIBERATE change (§3.9): reprices the
  // subscription from the next renewal, never mid-cycle.
  country: z.string().regex(/^[A-Za-z]{2}$/).optional().nullable(),
  // Org memberships only (ignored on person rows): raising it opens seats,
  // lowering it never evicts — occupancy above allowance just blocks adds.
  seat_allowance: z.number().int().min(1).max(10000).optional(),
});

// Grant kinds are a deploy-time vocabulary (like app-key scopes) — the DB
// deliberately has no CHECK so adding one here is enough.
// `team_calendar` (2026-10-12) is a TEAM's whole calendar at a percentage,
// and it is deliberately NOT a widening of `thread`. That kind means "enrol
// this member into THIS ONE named thread", it has a worker, and two live
// production grants are delivering through it — re-meaning it would silently
// change what people who already bought those tiers receive, and leave
// `thread_slug` as config nobody migrated.
const GrantKind = z.enum(['circle', 'thread', 'fibre_seat', 'google_user', 'team_calendar']);
// Grants attach to a PRODUCT (the promise carries its fulfillment —
// 2026-09-05); tier_id remains accepted for the legacy tier-level rows.
/** `team_calendar` config, checked HERE and not only in the form.
 *
 *  A 0% grant is a promise with nothing behind it — which is the exact
 *  failure this area already had once, when `thread` was offered with no
 *  worker: the product said a member got something and the member got
 *  nothing, silently, for months. So 0 is refused with the reason, and a tier
 *  that should not carry the calendar drops the grant instead of granting
 *  nothing.
 *
 *  Missing means 100 — the calendar-included case — because somebody has to
 *  type a number and a stray 0 would promise a calendar that charges full
 *  price. */
const CreateGrant = z
  .object({
    product_id: z.string().uuid().optional(),
    tier_id: z.string().uuid().optional(),
    kind: GrantKind,
    // Non-secret targeting only ({space_id} / {thread_slug} / {role}).
    // Credentials go in membership_settings, service-role only.
    config: z.record(z.string(), z.unknown()).default({}),
  })
  .superRefine((v, ctx) => {
    // A seat may name the team it lands in. Normalised here so a grant
    // written by a script carries the same shape as one written by the form,
    // exactly as the calendar's does.
    if (v.kind === 'fibre_seat') {
      const seat = parseFibreSeatConfig(v.config);
      if (seat.ok) v.config = seat.config;
      else ctx.addIssue({ code: 'custom', path: ['config'], message: seat.message });
      return;
    }
    if (v.kind !== 'team_calendar') return;
    const parsed = parseTeamCalendarConfig(v.config);
    if (parsed.ok) {
      // The NORMALISED config is what gets stored, so a grant written through
      // the API carries the same shape as one written through the form —
      // including the blank-means-100 default.
      v.config = parsed.config;
      return;
    }
    ctx.addIssue({ code: 'custom', path: ['config'], message: parsed.message });
  })
  .refine((v) => Boolean(v.product_id) !== Boolean(v.tier_id), {
    message: 'exactly one of product_id or tier_id',
  });

export const PutSettings = z.object({
  circle_api_token: z.string().max(500).optional().nullable(),
  // Google Workspace integration: the service-account key JSON (secret —
  // write-only, GET only echoes google_configured) + the delegation admin.
  google_sa_json: z.string().max(10000).optional().nullable(),
  google_admin_email: z.string().email().max(320).optional().nullable(),
  circle_community_url: z.string().url().max(500).optional().nullable(),
  join_page: z.record(z.string(), z.unknown()).optional(),
  // Fibre-seat policy (2026-09-05): approve-or-auto, and the standing
  // consent for seats that bill above the plan allowance.
  fibre_seat_mode: z.enum(['auto', 'approve']).optional(),
  // Member directory (docs/member-directory-spec.md §3.4).
  directory_enabled: z.boolean().optional(),
  directory_visibility: z.enum(['everybody', 'category']).optional(),
  directory_show_contact: z.boolean().optional(),
  directory_show_category: z.boolean().optional(),
  notify_members: z.boolean().optional(),
  directory_default_category_id: z.string().uuid().nullable().optional(),
  allow_billed_seats: z.boolean().optional(),
  // Default language of the community's public surfaces + member emails
  // (i18n P1). Per-member locale overrides it once known.
  locale: z.enum(LOCALES).optional(),
})
  // STRICT, not stripping, and this cost somebody a real afternoon. Zod
  // drops unknown keys by default, so when the web shipped `directory_enabled`
  // before the API knew the field, the save was accepted, 200 was returned,
  // the screen said saved — and nothing was written. Sjoerd set the switch,
  // was told it worked, and the directory stayed off.
  //
  // A field this route does not know is now a 400 that NAMES it. A deploy
  // ordering mistake becomes a loud error instead of a setting that silently
  // will not stick.
  .strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fail(c: any, where: string, error: { message: string; code?: string; details?: string; hint?: string }) {
  console.error(`[membership] ${where}`, error);
  // A ROW-LEVEL SECURITY REFUSAL IS NOT A SERVER ERROR. Routes that go
  // through `userClient` let RLS do the gating, which is the right design —
  // but it means "you may not do this" arrives as a Postgres error, and
  // reporting it as a 500 tells somebody the system is broken when the
  // system is working exactly as written. 42501 is the explicit code;
  // PostgREST does not always set it, so the message is checked too.
  const refused =
    error.code === '42501' || /row-level security|violates row-level/i.test(error.message ?? '');
  if (refused) {
    return c.json({ error: 'only an admin can do that', code: 'forbidden' }, 403);
  }
  return c.json({ error: error.message, code: error.code }, 500);
}

// membership_settings is service-role-only (it holds the Circle token), so
// RLS can't gate it — check explicitly. Two doors (2026-09-05, "some people
// should have access other than the workspace admin"): workspace admin, or
// app-level role 'admin' on Membership (mirrors the has_app_role RLS gate).
async function isMembershipAdmin(workspaceId: string, userId: string): Promise<boolean> {
  if (!userId) return false;
  const [{ data: wm }, app] = await Promise.all([
    adminClient
      .from('workspace_member')
      .select('workspace_role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .maybeSingle(),
    appId(),
  ]);
  if (wm?.workspace_role === 'admin' || wm?.workspace_role === 'super_admin') return true;
  if (!app) return false;
  const { data: am } = await adminClient
    .from('app_membership')
    .select('role')
    .eq('user_id', userId)
    .eq('app_id', app)
    .maybeSingle();
  return am?.role === 'admin';
}

// The email-locale chain (i18n P1): member.locale ?? membership_settings
// .locale ?? 'en'. Every member-facing send resolves through here.
export async function memberEmailLocale(
  workspaceId: string,
  memberLocale: string | null | undefined,
): Promise<Locale> {
  if (isLocale(memberLocale)) return memberLocale;
  const { data } = await adminClient
    .from('membership_settings')
    .select('locale')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return toLocale(data?.locale);
}

const membershipAppId = { id: null as string | null };
async function appId(): Promise<string | null> {
  if (membershipAppId.id) return membershipAppId.id;
  const { data } = await adminClient.from('app').select('id').eq('slug', 'membership').maybeSingle();
  membershipAppId.id = data?.id ?? null;
  return membershipAppId.id;
}

// Activity is the sanctioned wall-crossing: type + subject only, append-only.
// personId may be null for ORG membership rows — activity.person_id is NOT
// NULL and the platform has no organisation_id on activity yet (known open
// item), so org-level lifecycle events are simply not logged in v1. Seat
// grants/removals ARE logged, on the seated person.
export async function logMemberActivity(
  workspaceId: string,
  personId: string | null | undefined,
  type: string,
  subject: string,
): Promise<void> {
  if (!personId) return;
  const app = await appId();
  if (!app) return;
  await adminClient.from('activity').insert({
    workspace_id: workspaceId,
    person_id: personId,
    app_id: app,
    type,
    subject: subject.slice(0, 200),
    occurred_at: new Date().toISOString(),
  });
}

// Ensure the pending journal rows exist for every grant the member's tier
// carries (idempotent — unique (member_id, access_grant_id)); the sync
// worker (Phase D) drains them. Revocation flips existing rows instead.
export async function reconcileMemberAccess(memberId: string): Promise<void> {
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, organisation_id, tier_id, status')
    .eq('id', memberId)
    .maybeSingle();
  if (!member) return;

  // ORG membership (person_id NULL): the org itself holds no external
  // access — its SEATED PEOPLE do. Fan out: sync every seat row to the
  // org's tier + status, then reconcile each seat like the individual
  // member it mechanically is. Seats are person rows, so no recursion.
  if (member.organisation_id) {
    await reconcileOrgSeats(member as { id: string; tier_id: string; status: string });
    return;
  }

  // Entitlement = legacy tier-level grants + grants carried by the tier's
  // products (tier → membership_tier_product → product → grants) + grants
  // carried by products this person BOUGHT à la carte (2026-09-06). Bought
  // products are owned outright — their grants ride the member's journal
  // rows but survive tier changes AND lapse.
  const [{ data: tierGrants }, { data: tierProducts }, { data: bought }] = await Promise.all([
    adminClient.from('membership_access_grant').select('id').eq('tier_id', member.tier_id),
    adminClient.from('membership_tier_product').select('product_id').eq('tier_id', member.tier_id).eq('optional', false),
    adminClient
      .from('membership_product_purchase')
      .select('product_id')
      .eq('workspace_id', member.workspace_id)
      .eq('person_id', member.person_id)
      .eq('status', 'paid'),
  ]);
  const productIds = (tierProducts ?? []).map((tp) => tp.product_id);
  const { data: productGrants } = productIds.length
    ? await adminClient.from('membership_access_grant').select('id').in('product_id', productIds)
    : { data: [] as { id: string }[] };
  const boughtProductIds = [...new Set((bought ?? []).map((b) => b.product_id))];
  const { data: boughtGrants } = boughtProductIds.length
    ? await adminClient.from('membership_access_grant').select('id').in('product_id', boughtProductIds)
    : { data: [] as { id: string }[] };
  const boughtGrantIds = (boughtGrants ?? []).map((g) => g.id);
  const grants = [
    ...(tierGrants ?? []),
    ...(productGrants ?? []),
    ...(boughtGrants ?? []).filter(
      (bg) => !(tierGrants ?? []).some((g) => g.id === bg.id) && !(productGrants ?? []).some((g) => g.id === bg.id),
    ),
  ];

  if (member.status === 'active' || member.status === 'grace') {
    for (const g of grants ?? []) {
      const { error } = await adminClient
        .from('membership_member_access')
        .insert({ member_id: member.id, access_grant_id: g.id, status: 'pending' });
      if (error && error.code !== '23505') {
        console.error('[membership] access journal insert failed', error);
      }
    }
    const grantIds = (grants ?? []).map((g) => g.id);
    // REJOIN re-arm (gap found 2026-09-05): a lapse leaves the rows revoked,
    // and the inserts above no-op on the unique key — so a rejoining member's
    // entitled grants must flip back to pending or they never re-sync.
    if (grantIds.length) {
      await adminClient
        .from('membership_member_access')
        .update({ status: 'pending', last_error: null, updated_at: new Date().toISOString() })
        .eq('member_id', member.id)
        .in('access_grant_id', grantIds)
        .in('status', ['revoke_pending', 'revoked']);
    }
    // A tier change leaves stale granted rows for OTHER tiers' grants —
    // flag them for revocation.
    const { data: stale } = await adminClient
      .from('membership_member_access')
      .select('id, access_grant_id, status')
      .eq('member_id', member.id);
    for (const row of stale ?? []) {
      if (
        !grantIds.includes(row.access_grant_id) &&
        (row.status === 'granted' || row.status === 'pending' || row.status === 'awaiting_approval')
      ) {
        await adminClient
          .from('membership_member_access')
          .update({ status: row.status === 'granted' ? 'revoke_pending' : 'revoked', updated_at: new Date().toISOString() })
          .eq('id', row.id);
      }
    }
  } else {
    // Lapsed / cancelled — everything granted gets revoke-flagged, EXCEPT
    // grants from products the person bought à la carte: those were paid
    // for outright and do not lapse with the subscription.
    let revokeGranted = adminClient
      .from('membership_member_access')
      .update({ status: 'revoke_pending', updated_at: new Date().toISOString() })
      .eq('member_id', member.id)
      .eq('status', 'granted');
    let revokePending = adminClient
      .from('membership_member_access')
      .update({ status: 'revoked', updated_at: new Date().toISOString() })
      .eq('member_id', member.id)
      .in('status', ['pending', 'awaiting_approval']);
    if (boughtGrantIds.length) {
      const list = `(${boughtGrantIds.join(',')})`;
      revokeGranted = revokeGranted.not('access_grant_id', 'in', list);
      revokePending = revokePending.not('access_grant_id', 'in', list);
    }
    await revokeGranted;
    await revokePending;
    // A lapsed member still owns their bought products — keep their journal
    // rows alive (a purchase while lapsed lands here too).
    for (const gid of boughtGrantIds) {
      const { error } = await adminClient
        .from('membership_member_access')
        .insert({ member_id: member.id, access_grant_id: gid, status: 'pending' });
      if (error && error.code !== '23505') {
        console.error('[membership] access journal insert failed', error);
      }
    }
  }

  // A bought grant whose journal row was revoke-flagged earlier (revoked on
  // a lapse before the purchase, say) flips back to pending — the insert
  // above no-ops on the unique key, so this is the re-arm path.
  if (boughtGrantIds.length) {
    await adminClient
      .from('membership_member_access')
      .update({ status: 'pending', last_error: null, updated_at: new Date().toISOString() })
      .eq('member_id', member.id)
      .in('access_grant_id', boughtGrantIds)
      .in('status', ['revoke_pending', 'revoked']);
  }
}

// Seats follow the org membership (§3.5): tier and status propagate from
// the org row to its seat rows, then each seat reconciles as an individual
// member — a lapse revoke-flags every seated person's grants (with the
// bought-product exception living inside reconcileMemberAccess itself).
//
// Status convention: a seat row set 'cancelled' was INDIVIDUALLY removed
// by an admin and is never touched here — org-driven transitions only move
// seats between 'active' and 'lapsed', so a rejoining org re-arms its
// lapsed seats without resurrecting removed ones (the 2026-09-05 rejoin
// re-arm rule then flips their revoked journal rows back to pending).
export async function reconcileOrgSeats(org: {
  id: string;
  tier_id: string;
  status: string;
}): Promise<void> {
  const { data: seats } = await adminClient
    .from('membership_member')
    .select('id, person_id, tier_id, status')
    .eq('org_member_id', org.id)
    .is('deleted_at', null);
  const target = org.status === 'active' || org.status === 'grace' ? 'active' : 'lapsed';
  for (const seat of seats ?? []) {
    if (seat.status !== 'cancelled' && (seat.status !== target || seat.tier_id !== org.tier_id)) {
      const patch: Record<string, unknown> = {
        tier_id: org.tier_id,
        status: target,
        updated_at: new Date().toISOString(),
      };
      if (target === 'lapsed' && seat.status !== 'lapsed') patch.lapsed_at = new Date().toISOString();
      if (target === 'active') patch.lapsed_at = null;
      const { error } = await adminClient.from('membership_member').update(patch).eq('id', seat.id);
      if (error) {
        console.error('[membership] seat propagation failed', seat.id, error);
        continue;
      }
    }
    if (seat.status !== 'cancelled') await reconcileMemberAccess(seat.id);
  }
}

// Access composition changed (tier's products, or a product's grants) —
// re-reconcile everyone currently entitled through that tier.
export async function reconcileTierMembers(tierId: string): Promise<void> {
  const { data: members } = await adminClient
    .from('membership_member')
    .select('id')
    .eq('tier_id', tierId)
    .in('status', ['active', 'grace'])
    .is('deleted_at', null);
  for (const m of members ?? []) await reconcileMemberAccess(m.id);
}

async function reconcileProductMembers(productId: string): Promise<void> {
  const { data: links } = await adminClient
    .from('membership_tier_product')
    .select('tier_id')
    .eq('product_id', productId);
  for (const l of links ?? []) await reconcileTierMembers(l.tier_id);
}

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DISCOUNT CODES — the community's own, workspace-wide.
//
// Through `userClient`, deliberately: the RLS on `discount_code` says reads
// are for the workspace and WRITES are for an admin, and routing these
// through the user's own identity is what makes that policy the enforcement
// rather than a comment. The service-role client would bypass it and leave
// the role check to be re-implemented here, which is how two answers to "who
// may do this" get written.
//
// The public join path does NOT come through here — it reads with the
// service role through lib/discount-codes.ts, because somebody typing a code
// on a join page is not signed in to the workspace at all.
// ---------------------------------------------------------------------------

const DiscountCodeBody = z.object({
  code: z
    .string()
    .min(2)
    .max(60)
    // No wildcards: both are metacharacters to the layer that matches them,
    // so such a code could be stored and never redeemed.
    .refine(isStorableCode, { message: 'a code cannot contain % or *' }),
  name: z.string().max(200).nullable().optional(),
  type: z.enum(['percentage', 'amount', 'free']),
  discount_percentage: z.number().min(0).max(100).nullable().optional(),
  discount_amount_cents: z.number().int().min(0).nullable().optional(),
  usage_limit: z.number().int().positive().nullable().optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  is_early_bird: z.boolean().optional(),
  early_bird_deadline: z.string().datetime({ offset: true }).nullable().optional(),
  is_active: z.boolean().optional(),
  // WHAT IT APPLIES TO. The database CHECK insists these two agree, so the
  // route never has to decide what a 'tier' code with no id would mean.
  applies_to: z.enum(['workspace', 'thread', 'ticket', 'tier', 'product']).default('workspace'),
  applies_to_id: z.string().uuid().nullable().optional(),
});

const CODE_SELECT =
  'id, code, name, type, discount_percentage, discount_amount_cents, usage_limit, used_count, expires_at, is_early_bird, early_bird_deadline, is_active, applies_to, applies_to_id, created_at';

membershipRoutes.get('/discount-codes', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('discount_code')
    .select(CODE_SELECT)
    .order('created_at', { ascending: false });
  if (error) return fail(c, 'list discount codes', error);
  return c.json({ items: data ?? [] });
});

membershipRoutes.post('/discount-codes', async (c) => {
  const ctx = c.get('ctx');
  const body = DiscountCodeBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('discount_code')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select(CODE_SELECT)
    .single();
  // 23505 is the one a person causes and can fix, so it is said plainly
  // rather than as a 500: one code per community, compared without case.
  if (error?.code === '23505') {
    return c.json({ error: 'a code with that text already exists here' }, 409);
  }
  if (error) return fail(c, 'create discount code', error);
  return c.json(data, 201);
});

membershipRoutes.patch('/discount-codes/:id', async (c) => {
  const ctx = c.get('ctx');
  const body = DiscountCodeBody.partial().safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('discount_code')
    .update(body.data)
    .eq('id', c.req.param('id'))
    .select(CODE_SELECT)
    .maybeSingle();
  if (error?.code === '23505') {
    return c.json({ error: 'a code with that text already exists here' }, 409);
  }
  if (error) return fail(c, 'update discount code', error);
  // Nothing updated means RLS refused it or it is not this workspace's —
  // which are the same answer to the person asking.
  if (!data) return c.json({ error: 'not found' }, 404);
  return c.json(data);
});

membershipRoutes.delete('/discount-codes/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('discount_code').delete().eq('id', c.req.param('id'));
  if (error) return fail(c, 'delete discount code', error);
  return c.body(null, 204);
});

membershipRoutes.get('/tiers', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_tier')
    .select(
      'id, name, description, characteristics, price_cents_year, price_cents_month, currency, first_period_ends_on, hidden, price_includes_vat, stripe_price_id_year, stripe_price_id_month, sort_order, archived_at, created_at, membership_tier_product ( product_id, optional )',
    )
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list tiers', error);
  const includeArchived = c.req.query('archived') === 'true';
  const items = (data ?? [])
    .filter((t) => includeArchived || !t.archived_at)
    .map((t) => ({
      ...t,
      product_ids: (t.membership_tier_product ?? [])
        .filter((l: { optional?: boolean }) => !l.optional)
        .map((l: { product_id: string }) => l.product_id),
      optional_product_ids: (t.membership_tier_product ?? [])
        .filter((l: { optional?: boolean }) => l.optional)
        .map((l: { product_id: string }) => l.product_id),
      membership_tier_product: undefined,
    }));
  return c.json({ items });
});

membershipRoutes.post('/tiers', async (c) => {
  const body = CreateTier.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_tier')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id')
    .single();
  if (error) return fail(c, 'create tier', error);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.patch('/tiers/:id', async (c) => {
  const body = PatchTier.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { error } = await db.from('membership_tier').update(patch).eq('id', c.req.param('id'));
  if (error) return fail(c, 'patch tier', error);
  return c.json({ ok: true });
});

// Replace a tier's included products in one call (the dialog saves whole).
membershipRoutes.put('/tiers/:id/products', async (c) => {
  const body = z
    .object({
      product_ids: z.array(z.string().uuid()).max(100),
      // Offered as tick-boxes on the join page rather than always included.
      optional_product_ids: z.array(z.string().uuid()).max(100).default([]),
    })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const tierId = c.req.param('id');

  const { data: existing, error: readErr } = await db
    .from('membership_tier_product')
    .select('id, product_id, optional')
    .eq('tier_id', tierId);
  if (readErr) return fail(c, 'read tier products', readErr);

  // One product = one link, included OR optional (included wins a dupe).
  const want = new Map<string, boolean>();
  for (const id of body.data.optional_product_ids) want.set(id, true);
  for (const id of body.data.product_ids) want.set(id, false);
  const toDelete = (existing ?? [])
    .filter((r) => !want.has(r.product_id) || want.get(r.product_id) !== Boolean(r.optional))
    .map((r) => r.id);
  const have = new Map((existing ?? []).map((r) => [r.product_id, Boolean(r.optional)]));
  const toInsert = [...want.entries()]
    .filter(([id, opt]) => !have.has(id) || have.get(id) !== opt)
    .map(([product_id, optional]) => ({ tier_id: tierId, product_id, optional }));

  if (toDelete.length) {
    const { error } = await db.from('membership_tier_product').delete().in('id', toDelete);
    if (error) return fail(c, 'unlink tier products', error);
  }
  if (toInsert.length) {
    const { error } = await db.from('membership_tier_product').insert(toInsert);
    if (error) return fail(c, 'link tier products', error);
  }
  if (toDelete.length || toInsert.length) void reconcileTierMembers(tierId);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

membershipRoutes.get('/products', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_product')
    .select('id, name, description, characteristics, price_cents, currency, links, purchasable, sort_order, archived_at, created_at, price_interval, group_id, price_includes_vat')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list products', error);
  const includeArchived = c.req.query('archived') === 'true';
  return c.json({ items: (data ?? []).filter((p) => includeArchived || !p.archived_at) });
});

membershipRoutes.post('/products', async (c) => {
  const body = CreateProduct.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_product')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id')
    .single();
  if (error) return fail(c, 'create product', error);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.patch('/products/:id', async (c) => {
  const body = PatchProduct.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest, updated_at: new Date().toISOString() };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  // A group of THIS workspace, live — read through RLS, which only shows
  // this workspace's rows (the FK alone would accept another's).
  if (rest.group_id) {
    const { data: g } = await db.from('membership_product_group').select('id').eq('id', rest.group_id).is('archived_at', null).maybeSingle();
    if (!g) return c.json({ error: 'product group not found' }, 400);
  }
  const { error } = await db.from('membership_product').update(patch).eq('id', c.req.param('id'));
  if (error) return fail(c, 'patch product', error);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Product groups (2026-10-16) — organising only: where a product is listed in
// Members → Products and on the join page. No effect on access, pricing or
// the directory (that is membership_directory_category). Through userClient,
// so the RLS (read: the workspace; write: an admin) is the enforcement.
// ---------------------------------------------------------------------------

membershipRoutes.get('/product-groups', async (c) => {
  const db = userClient(c.get('ctx').jwt);
  const { data, error } = await db
    .from('membership_product_group')
    .select('id, name, sort_order, archived_at')
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list product groups', error);
  return c.json({ items: data ?? [] });
});

membershipRoutes.post('/product-groups', async (c) => {
  const body = z.object({ name: z.string().trim().min(1).max(120) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: last } = await db.from('membership_product_group').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const { data, error } = await db
    .from('membership_product_group')
    .insert({ workspace_id: ctx.workspaceId, name: body.data.name, sort_order: ((last ?? [])[0]?.sort_order ?? 0) + 10 })
    .select('id, name, sort_order, archived_at')
    .single();
  if (error) return fail(c, 'create product group', error);
  return c.json(data, 201);
});

membershipRoutes.patch('/product-groups/:id', async (c) => {
  const body = z
    .object({ name: z.string().trim().min(1).max(120).optional(), archived: z.boolean().optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const db = userClient(c.get('ctx').jwt);
  const id = c.req.param('id');
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.data.name !== undefined) patch.name = body.data.name;
  if (body.data.archived !== undefined) patch.archived_at = body.data.archived ? new Date().toISOString() : null;
  const { data, error } = await db.from('membership_product_group').update(patch).eq('id', id).select('id').maybeSingle();
  if (error) return fail(c, 'patch product group', error);
  if (!data) return c.json({ error: 'not found' }, 404);
  // Archiving UNGROUPS its products; it never hides them.
  if (body.data.archived) {
    const { error: uErr } = await db.from('membership_product').update({ group_id: null }).eq('group_id', id);
    if (uErr) return fail(c, 'ungroup products', uErr);
  }
  return c.json({ ok: true });
});

// PUT /product-groups/order {ids} — drag-and-drop order (never a number field).
membershipRoutes.put('/product-groups/order', async (c) => {
  const body = z.object({ ids: z.array(z.string().uuid()).max(200) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const db = userClient(c.get('ctx').jwt);
  for (const [i, id] of body.data.ids.entries()) {
    const { error } = await db.from('membership_product_group').update({ sort_order: (i + 1) * 10 }).eq('id', id);
    if (error) return fail(c, 'order product groups', error);
  }
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

const MemberListQuery = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: MemberStatus.optional(),
  tier_id: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(100).optional(),
});

/** One billing period on from a date, in UTC. */
function addInterval(from: Date, interval: 'year' | 'month'): Date {
  const d = new Date(from);
  if (interval === 'month') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}

/** A membership invoice was paid — by the payment link in the invoice email
 *  or by an admin marking it paid. Settling the ledger row was never enough
 *  on its own: the membership kept the status and renewal date it was
 *  created with, so someone who paid on day one stayed in grace (soul.com,
 *  2026-09-09). Item refs are `member-inv-<member id>-<n>`; anything else
 *  belongs to another app and is left alone. */
export async function activateMemberFromInvoice(itemRef: string): Promise<void> {
  const match = /^member-inv-([0-9a-f-]{36})-\d+$/i.exec(itemRef);
  const memberId = match?.[1];
  if (!memberId) return;
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, status, renews_at')
    .eq('id', memberId)
    .is('deleted_at', null)
    .maybeSingle();
  if (!member) return;

  // The interval the invoice was raised for, stamped into billing when it
  // was created. Yearly is the default everywhere else in this app.
  const { data: purchase } = await adminClient
    .from('purchase')
    .select('billing')
    .eq('item_ref', itemRef)
    .maybeSingle();
  const interval =
    (purchase?.billing as { membership_interval?: string } | null)?.membership_interval === 'month'
      ? 'month'
      : 'year';

  // Roll forward from whichever is later — the date already on the row, or
  // now. A late payment must not buy back a period that already elapsed.
  const current = member.renews_at ? new Date(member.renews_at) : null;
  const from = current && current.getTime() > Date.now() ? current : new Date();
  await adminClient
    .from('membership_member')
    .update({
      status: 'active',
      lapsed_at: null,
      renews_at: addInterval(from, interval).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', memberId);
  await logMemberActivity(
    member.workspace_id,
    member.person_id,
    'membership_renewed',
    'Invoice paid — membership active',
  );
  await reconcileMemberAccess(memberId);
}

const MEMBER_SELECT =
  'id, person_id, organisation_id, seat_allowance, org_member_id, tier_id, status, started_at, renews_at, lapsed_at, stripe_subscription_id, notes, country, created_at, ' +
  'person:person_id (id, first_name, last_name, email), tier:tier_id (id, name), ' +
  'organisation:organisation_id (id, name), ' +
  // A seat row's parent org membership → the organisation it seats under.
  'org_member:org_member_id (id, organisation:organisation_id (id, name))';

membershipRoutes.get('/members', async (c) => {
  const parsed = MemberListQuery.safeParse(Object.fromEntries(new URL(c.req.url).searchParams));
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);
  const { after, limit, status, tier_id, q } = parsed.data;

  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  let query = db
    .from('membership_member')
    .select(MEMBER_SELECT)
    .order('id', { ascending: true })
    .limit(limit + 1);
  if (after) query = query.gt('id', after);
  if (status) query = query.eq('status', status);
  if (tier_id) query = query.eq('tier_id', tier_id);

  const { data, error } = await query;
  if (error) return fail(c, 'list members', error);

  // The concatenated select string defeats supabase-js type inference —
  // rows come back as GenericStringError without the cast.
  type MemberRow = {
    id: string;
    person: { first_name?: string; last_name?: string; email?: string } | null;
    organisation: { name?: string } | null;
  };
  let rows = (data ?? []) as unknown as MemberRow[];
  // Person/org-name search filters the page in memory — PostgREST can't
  // ilike across the embedded relation. Acceptable at community scale;
  // revisit with an RPC if a workspace passes ~thousands of members.
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((m) =>
      [m.person?.first_name, m.person?.last_name, m.person?.email, m.organisation?.name].some((v) =>
        v?.toLowerCase().includes(needle),
      ),
    );
  }
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return c.json({ items, next: hasMore ? items[items.length - 1]?.id : null });
});

membershipRoutes.get('/members/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_member')
    .select(MEMBER_SELECT)
    .eq('id', c.req.param('id'))
    .maybeSingle();
  if (error) return fail(c, 'get member', error);
  if (!data) return c.json({ error: 'not found' }, 404);
  const member = data as unknown as Record<string, unknown> & { id: string };

  const { data: access } = await db
    .from('membership_member_access')
    .select('id, access_grant_id, status, external_ref, last_error, synced_at')
    .eq('member_id', member.id);
  return c.json({ ...member, access: access ?? [] });
});

// Manual add (admin door — the paid door is the public join flow, Phase B).
membershipRoutes.post('/members', async (c) => {
  const body = CreateMember.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { billing, interval: requestedInterval, invite, country, ...memberFields } = body.data;
  const isOrg = Boolean(memberFields.organisation_id);
  // The tier decides the interval, not the caller: an UNPRICED tier renews
  // yearly (membership-interval.ts — the launch-test defect of 2026-09-23,
  // where comped cooperative members were dated one month out).
  const { data: tier } = await db
    .from('membership_tier')
    // `description` and `characteristics` are the community's own words about
    // this tier. They feed the welcome email, which shows them exactly as the
    // paid join does — one template, so one set of inputs.
    .select('name, description, characteristics, price_cents_year, price_cents_month, currency')
    .eq('id', memberFields.tier_id)
    .maybeSingle();
  const interval = effectiveInterval(tier, requestedInterval);
  // A membership added today renews a period from today. Left to the caller
  // this arrived blank, or — worse — as today's date, which the overdue
  // sweep read as already due and graced minutes later (soul.com, 2026-09-09).
  const startedAt = memberFields.started_at ? new Date(memberFields.started_at) : new Date();
  const renewsAt =
    memberFields.renews_at === undefined
      ? addInterval(startedAt, interval).toISOString()
      : memberFields.renews_at;
  const { data, error } = await db
    .from('membership_member')
    .insert({
      ...memberFields,
      renews_at: renewsAt,
      // Org rows always carry an allowance (the UI sends one; default 1).
      ...(isOrg && !memberFields.seat_allowance ? { seat_allowance: 1 } : {}),
      ...(country && !isOrg ? { country: country.toUpperCase() } : {}),
      workspace_id: ctx.workspaceId,
    })
    .select('id, person_id, organisation_id, seat_allowance, tier_id, status')
    .single();
  if (error) {
    if (error.code === '23505') {
      return c.json(
        {
          error: isOrg
            ? 'This organisation already has a membership in this workspace.'
            : 'This person already has a membership in this workspace.',
        },
        409,
      );
    }
    return fail(c, 'create member', error);
  }

  // ORG membership (§3.5 v1): manual/invoice billing only — the org pays by
  // invoice (tier price × seats) against its org_billing contact. No Stripe
  // subscription, no invite email (the portal is a person surface), no
  // activity row (activity.person_id is NOT NULL; org activity is a known
  // open platform item). Seats are added afterwards via /members/:id/seats.
  if (isOrg) {
    let invoiceError: string | null = null;
    if (billing === 'invoice') {
      const base = interval === 'year' ? tier?.price_cents_year : tier?.price_cents_month;
      const seatCount = data.seat_allowance ?? 1;
      const orgBilling = await organisationBilling(data.organisation_id as string);
      const payerEmail = orgBilling?.billing_email ?? null;
      if (base == null || base <= 0) {
        invoiceError = `The tier has no ${interval}ly price — membership created without an invoice.`;
      } else if (!payerEmail) {
        invoiceError =
          'The organisation has no billing email — membership created without an invoice. Add one on the organisation and re-send from the Invoices page.';
      } else {
        // Deliberately NO pricing-logic evaluation: §3.9 rules key on
        // person attributes (self-declared country, interval discounts for
        // individuals) — org invoices are flat tier price × seats.
        const amount = base * seatCount;
        const itemRef = `member-inv-${data.id}-1`;
        await recordPurchase({
          appSlug: 'membership',
          workspaceId: ctx.workspaceId,
          itemRef,
          organiserUserId: ctx.userId || null,
          payerName: orgBilling?.legal_name ?? orgBilling?.name ?? 'Organisation',
          payerEmail,
          payerOrgId: data.organisation_id as string,
          itemLabel: `${(await adminClient.from('workspace').select('name').eq('id', ctx.workspaceId).maybeSingle()).data?.name ?? 'Community'} membership — ${tier?.name ?? ''} (${seatCount} seat${seatCount === 1 ? '' : 's'}, ${interval}ly)`,
          amountCents: amount,
          currency: tier?.currency ?? 'EUR',
          method: 'invoice',
          status: 'pending',
          billing: {
            membership_interval: interval,
            ...(orgBilling ? organisationBillingSnapshot(orgBilling) : {}),
          },
        });
        const { data: saved } = await adminClient
          .from('purchase')
          .select(
            'id, payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, billing, stripe_invoice_url, organiser_user_id, app_id',
          )
          .eq('item_ref', itemRef)
          .maybeSingle();
        if (saved) {
          const payUrl = await createMembershipPaymentLink({
            purchaseId: saved.id,
            workspaceId: ctx.workspaceId,
            amountCents: amount,
            currency: tier?.currency ?? 'EUR',
            itemLabel: saved.item_label,
            payerEmail,
          });
          void sendReceipt(
            ctx.workspaceId,
            saved as Record<string, unknown>,
            undefined,
            undefined,
            payUrl ? payButtonHtml(payUrl) : undefined,
          ).catch((e) => console.error('[membership] org invoice email failed', e));
        }
      }
    }
    return c.json({ id: data.id, ...(invoiceError ? { invoice_error: invoiceError } : {}) }, 201);
  }

  await logMemberActivity(ctx.workspaceId, data.person_id, 'membership_joined', `Joined · ${tier?.name ?? 'membership'}`);
  await reconcileMemberAccess(data.id);

  const [{ data: person }, { data: ws }, brand] = await Promise.all([
    adminClient
      .from('person')
      .select('first_name, last_name, email, street, postal_code, city, country')
      .eq('id', data.person_id)
      .maybeSingle(),
    // `id` as well as `name`: the welcome email resolves the member's
    // language from the workspace.
    adminClient.from('workspace').select('id, name').eq('id', ctx.workspaceId).maybeSingle(),
    getWorkspaceBrand(ctx.workspaceId),
  ]);

  // Invoice path: a PENDING ledger row (tier price × pricing rules for the
  // declared country), invoiced by email in the house style. Mark paid /
  // send payment link live on the Invoices page like every other invoice.
  let invoiceError: string | null = null;
  if (billing === 'invoice') {
    const base = interval === 'year' ? tier?.price_cents_year : tier?.price_cents_month;
    if (base == null || base <= 0) {
      invoiceError = `The tier has no ${interval}ly price — member created without an invoice.`;
    } else if (!person?.email) {
      invoiceError = 'The person has no email — member created without an invoice.';
    } else {
      const logic = await priceLogicFor(ctx.workspaceId, data.tier_id);
      const { pct } = evaluatePriceLogic(logic, { country: country ?? null, interval });
      const amount = applyPct(base, pct);
      const { data: pb } = await adminClient
        .from('person_billing')
        .select('tax_id, legal_name')
        .eq('person_id', data.person_id)
        .maybeSingle();
      const itemRef = `member-inv-${data.id}-1`;
      await recordPurchase({
        appSlug: 'membership',
        workspaceId: ctx.workspaceId,
        itemRef,
        personId: data.person_id,
        // The adding admin is the seller contact — without it the invoice is
        // invisible on their "Me" scope ("my invoice list is also empty").
        organiserUserId: ctx.userId || null,
        payerName:
          pb?.legal_name ?? [person.first_name, person.last_name].filter(Boolean).join(' '),
        payerEmail: person.email,
        itemLabel: `${ws?.name ?? 'Community'} membership — ${tier?.name ?? ''} (${interval}ly)`,
        amountCents: amount,
        currency: tier?.currency ?? 'EUR',
        method: 'invoice',
        status: 'pending',
        billing: {
          membership_interval: interval,
          address: person.street ?? null,
          postal_code: person.postal_code ?? null,
          city: person.city ?? null,
          country: person.country ?? country ?? null,
          ...(pb?.tax_id ? { tax_no: pb.tax_id } : {}),
        },
      });
      const { data: saved } = await adminClient
        .from('purchase')
        .select(
          'id, payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, billing, stripe_invoice_url, organiser_user_id, app_id',
        )
        .eq('item_ref', itemRef)
        .maybeSingle();
      if (saved) {
        // Pay button straight in the invoice email ("no payment link though") —
        // when the workspace has no connected Stripe account the invoice still
        // goes out, bank-transfer style.
        const payUrl = await createMembershipPaymentLink({
          purchaseId: saved.id,
          workspaceId: ctx.workspaceId,
          amountCents: amount,
          currency: tier?.currency ?? 'EUR',
          itemLabel: saved.item_label,
          payerEmail: person.email,
        });
        void sendReceipt(
          ctx.workspaceId,
          saved as Record<string, unknown>,
          undefined,
          undefined,
          payUrl ? payButtonHtml(payUrl) : undefined,
        ).catch((e) => console.error('[membership] manual invoice email failed', e));
      }
    }
  }

  // Invite: the member-portal sign-in email. Auth account first (the join
  // flow's auto-create), then a workspace-branded note.
  //
  // DETACHED, and that is the fix for a real bug. Until 2026-10-05 this block
  // was awaited before the response, so an admin adding a member with "send
  // an invitation email" ticked waited on an auth_user_exists RPC, possibly a
  // GoTrue createUser, and an SMTP round trip — with the member row ALREADY
  // written. Sjoerd reported the dialog "keeps on hanging" on Saving…; the
  // member had saved, and the response was being held by the email.
  //
  // Nothing is lost by detaching: the catch below only ever logged a warning,
  // so a failure was never reported to the caller anyway. What changes is
  // that a slow provider no longer looks like a broken save.
  if (invite && person?.email) {
    void (async () => {
    try {
      const { data: hasAccount } = await adminClient.rpc('auth_user_exists', {
        p_email: person.email.toLowerCase(),
      });
      if (hasAccount !== true) {
        await adminClient.auth.admin.createUser({
          email: person.email.toLowerCase(),
          email_confirm: true,
        });
      }
      // THE SAME WELCOME AS A PAID JOIN. One email, two triggers.
      //
      // This was three hand-written lines with its own `shell` call, so a
      // member an admin added by hand got a different — and much thinner —
      // first impression than one who joined and paid, at a different text
      // size, pointing at a different portal. Sjoerd found it on production
      // by adding himself: "Not 1,5 size", and then the button took him to
      // the Members app's own old page instead of my.thread.
      //
      // Two templates for one moment will always drift, because only one of
      // them is ever in front of whoever is editing. So this calls
      // `membershipWelcome` with `invoiceFollows: false` — the one real
      // difference, since nobody is billed on this path and promising an
      // invoice that never arrives is worse than saying nothing.
      // AND THE SAME CONTENT, not just the same template. v1.186.0 passed
      // `renewsAt: null` and no calendar, which made "one welcome, two
      // triggers" true of the layout and false of what it said. Both are
      // right here: `renewsAt` is the date this handler just computed and
      // wrote (the admin set it in that dialog), and the calendars come from
      // the same resolver the paid path and the member price use.
      const communityName = ws?.name ?? 'the community';
      const welcomeLocale = await memberEmailLocale(ws?.id ?? '', null);
      const welcomePortal = `${stackSurfaceUrl('my-portal', process.env)}/memberships`;
      const msg = membershipWelcome({
        name: person.first_name ?? 'there',
        communityName,
        tierName: tier?.name ?? 'membership',
        renewsAt,
        tierDescription: tier?.description ?? null,
        characteristics: (tier?.characteristics as string[] | null) ?? null,
        calendarTeamNames: await teamCalendarNamesFor(memberFields.tier_id, {
          personId: data.person_id as string,
          workspaceId: ctx.workspaceId,
        }),
        portalUrl: `${stackSurfaceUrl('my-portal', process.env)}/memberships`,
        email: person.email,
        invoiceFollows: false,
        locale: welcomeLocale,
        brand: { logoUrl: brand.logoUrl, name: brand.fromName },
        // The community's own words, when it wrote any (Settings → Emails).
        custom: await communityWords({
          workspaceId: ctx.workspaceId,
          kind: 'welcome',
          tierId: memberFields.tier_id,
          memberLocale: welcomeLocale,
          values: memberEmailValues({ firstName: person.first_name, lastName: person.last_name, communityName, tierName: tier?.name, renewsAt, portalUrl: welcomePortal, locale: welcomeLocale }),
        }),
      });
      await sendEmail({
        to: person.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...senderOf(brand),
      });
    } catch (e) {
      console.warn('[membership] invite email failed', e);
    }
    })();
  }

  return c.json({ id: data.id, ...(invoiceError ? { invoice_error: invoiceError } : {}) }, 201);
});

membershipRoutes.patch('/members/:id', async (c) => {
  const body = PatchMember.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const memberId = c.req.param('id');

  const { data: before, error: readErr } = await db
    .from('membership_member')
    .select('id, person_id, organisation_id, tier_id, status, country, stripe_subscription_id, workspace_id, tier:tier_id (name)')
    .eq('id', memberId)
    .maybeSingle();
  if (readErr) return fail(c, 'read member', readErr);
  if (!before) return c.json({ error: 'not found' }, 404);

  const patch: Record<string, unknown> = { ...body.data, updated_at: new Date().toISOString() };
  // Person concepts stay off org rows and vice versa (the DB CHECKs would
  // reject them anyway — strip early for a clean error surface).
  if (before.organisation_id) delete patch.country;
  else delete patch.seat_allowance;
  if (body.data.status === 'lapsed' && before.status !== 'lapsed') patch.lapsed_at = new Date().toISOString();

  // A TIER CHANGE ON A RUNNING STRIPE SUBSCRIPTION goes through the member's
  // own path (lib/membership-change.ts, P3): the membership line's price
  // moves, prorated to the renewal date — an upgrade is charged, a downgrade
  // credited. Before 2026-10-16 an admin's tier change touched only this row,
  // so Stripe kept charging the old tier's price. A subscription that cannot
  // change (stopping, not active, no account) keeps the old row-only
  // behaviour; a Stripe failure stops the patch, so row and charge agree.
  let stripeChange: { credit_cents: number; refunded_cents: number } | null = null;
  if (body.data.tier_id && body.data.tier_id !== before.tier_id && before.stripe_subscription_id && !before.organisation_id) {
    const { loadCtx, changeTier } = await import('../lib/membership-change.js');
    const { data: ids } = await adminClient.from('membership_member').select('stripe_customer_id').eq('id', memberId).maybeSingle();
    if (ids?.stripe_customer_id) {
      const loaded = await loadCtx({
        id: memberId,
        workspace_id: before.workspace_id as string,
        person_id: before.person_id as string,
        tier_id: before.tier_id as string,
        country: (before.country as string | null) ?? null,
        stripe_subscription_id: before.stripe_subscription_id as string,
        stripe_customer_id: ids.stripe_customer_id as string,
      }).catch(() => null);
      if (loaded && !('error' in loaded)) {
        try {
          stripeChange = await changeTier(loaded, body.data.tier_id, reconcileMemberAccess);
        } catch (e) {
          console.error('[membership] admin tier change at Stripe failed', { member: memberId, message: (e as Error).message });
          return c.json({ error: `The membership could not be changed at Stripe: ${(e as Error).message}` }, 502);
        }
      }
    }
  }
  const { error } = await db.from('membership_member').update(patch).eq('id', memberId);
  if (error) return fail(c, 'patch member', error);

  // Lifecycle + tier changes cross the wall as activity (type + subject).
  if (body.data.tier_id && body.data.tier_id !== before.tier_id) {
    const { data: tier } = await db.from('membership_tier').select('name').eq('id', body.data.tier_id).maybeSingle();
    await logMemberActivity(ctx.workspaceId, before.person_id, 'membership_tier_changed', `Tier changed · ${tier?.name ?? ''}`);
  }
  if (body.data.status && body.data.status !== before.status) {
    const subjectByStatus: Record<string, [string, string]> = {
      active: before.status === 'lapsed' || before.status === 'cancelled'
        ? ['membership_rejoined', 'Rejoined']
        : ['membership_renewed', 'Membership active'],
      grace: ['membership_payment_failed', 'Payment failed — grace period'],
      lapsed: ['membership_lapsed', 'Membership lapsed'],
      cancelled: ['membership_cancelled', 'Membership cancelled'],
    };
    const entry = subjectByStatus[body.data.status];
    if (entry) await logMemberActivity(ctx.workspaceId, before.person_id, entry[0], entry[1]);
  }
  if (body.data.tier_id || body.data.status) await reconcileMemberAccess(memberId);

  // Country changed on a live subscription → reprice FROM THE NEXT RENEWAL
  // (proration none — the seat policy's sibling). Failures are surfaced,
  // not swallowed: a price that silently didn't change is worse than an
  // error the admin sees.
  const newCountry = body.data.country === undefined ? undefined : body.data.country?.toUpperCase() ?? null;
  if (
    newCountry !== undefined &&
    newCountry !== (before.country?.toUpperCase() ?? null) &&
    before.stripe_subscription_id
  ) {
    const r = await repriceMemberSubscription(memberId);
    if (!r.ok) return c.json({ ok: true, reprice_error: r.error });
    await logMemberActivity(
      ctx.workspaceId,
      before.person_id,
      'membership_repriced',
      `Repriced from next renewal (${newCountry ?? 'no country'})`,
    );
    return c.json({ ok: true, repriced: true });
  }
  return c.json({ ok: true, ...(stripeChange ? { stripe_change: stripeChange } : {}) });
});

// ---------------------------------------------------------------------------
// Org membership seats (§3.5 v1). A seat is a person-keyed membership_member
// row whose org_member_id points at the org membership — mechanically an
// individual member (same journal, workers, portal, profile tab), whose tier
// and status FOLLOW the org row (reconcileOrgSeats). 'cancelled' on a seat =
// individually removed (soft); org-driven transitions use active/lapsed.
// ---------------------------------------------------------------------------

const SEAT_SELECT =
  'id, person_id, status, started_at, lapsed_at, created_at, person:person_id (id, first_name, last_name, email)';

async function orgMemberRow(db: ReturnType<typeof userClient>, memberId: string) {
  const { data } = await db
    .from('membership_member')
    .select('id, workspace_id, organisation_id, seat_allowance, tier_id, status')
    .eq('id', memberId)
    .maybeSingle();
  return data && data.organisation_id ? data : null;
}

membershipRoutes.get('/members/:id/seats', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const org = await orgMemberRow(db, c.req.param('id'));
  if (!org) return c.json({ error: 'not found' }, 404);
  const { data, error } = await db
    .from('membership_member')
    .select(SEAT_SELECT)
    .eq('org_member_id', org.id)
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list seats', error);
  const items = data ?? [];
  const occupied = items.filter((s) => s.status === 'active' || s.status === 'grace').length;
  return c.json({ items, occupied, allowance: org.seat_allowance ?? 1 });
});

const CreateSeat = z.object({ person_id: z.string().uuid() });

membershipRoutes.post('/members/:id/seats', async (c) => {
  const body = CreateSeat.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const org = await orgMemberRow(db, c.req.param('id'));
  if (!org) return c.json({ error: 'not found' }, 404);

  // Allowance gate: occupied seats vs seat_allowance. Never bills anything —
  // an org over its allowance simply can't add (raise the allowance first;
  // the next org invoice covers it).
  const { count: occupied } = await db
    .from('membership_member')
    .select('id', { count: 'exact', head: true })
    .eq('org_member_id', org.id)
    .in('status', ['active', 'grace']);
  const allowance = org.seat_allowance ?? 1;
  if ((occupied ?? 0) >= allowance) {
    return c.json(
      { error: `All ${allowance} seat${allowance === 1 ? ' is' : 's are'} occupied — raise the seat allowance first.` },
      409,
    );
  }

  // The seat's status follows the org membership from birth.
  const target = org.status === 'active' || org.status === 'grace' ? 'active' : 'lapsed';

  // A person holds ONE membership per workspace (unique workspace_id ×
  // person_id): re-adding a removed seat of THIS org re-arms the same row;
  // any other existing membership is a 409.
  const { data: existing } = await db
    .from('membership_member')
    .select('id, org_member_id, status')
    .eq('workspace_id', ctx.workspaceId)
    .eq('person_id', body.data.person_id)
    .maybeSingle();
  let seatId: string;
  if (existing) {
    if (existing.org_member_id !== org.id) {
      return c.json(
        { error: 'This person already has a membership in this workspace (own or via another organisation).' },
        409,
      );
    }
    if (existing.status === 'active' || existing.status === 'grace') {
      return c.json({ error: 'This person already occupies a seat.' }, 409);
    }
    const { error } = await db
      .from('membership_member')
      .update({ status: target, tier_id: org.tier_id, lapsed_at: null, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (error) return fail(c, 'rearm seat', error);
    seatId = existing.id;
  } else {
    const { data: created, error } = await db
      .from('membership_member')
      .insert({
        workspace_id: ctx.workspaceId,
        person_id: body.data.person_id,
        tier_id: org.tier_id,
        status: target,
        org_member_id: org.id,
      })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        return c.json({ error: 'This person already has a membership in this workspace.' }, 409);
      }
      return fail(c, 'create seat', error);
    }
    seatId = created.id;
  }

  const { data: orgRow } = await db
    .from('organisation')
    .select('name')
    .eq('id', org.organisation_id)
    .maybeSingle();
  await logMemberActivity(
    ctx.workspaceId,
    body.data.person_id,
    'membership_seat_granted',
    `Seat granted · ${orgRow?.name ?? 'organisation'}`,
  );
  // Seat-holders get the tier's grants exactly like an individual member.
  await reconcileMemberAccess(seatId);
  return c.json({ id: seatId }, 201);
});

// Soft removal: the seat row (and its journal history) stays, status
// 'cancelled' marks it individually removed — reconcile revoke-flags the
// person's grants, EXCEPT grants from products they bought outright (the
// same exception as individual members, built into reconcileMemberAccess).
membershipRoutes.delete('/members/:id/seats/:seatId', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const org = await orgMemberRow(db, c.req.param('id'));
  if (!org) return c.json({ error: 'not found' }, 404);
  const { data: seat } = await db
    .from('membership_member')
    .select('id, person_id, status, org_member_id')
    .eq('id', c.req.param('seatId'))
    .maybeSingle();
  if (!seat || seat.org_member_id !== org.id) return c.json({ error: 'not found' }, 404);
  if (seat.status === 'cancelled') return c.json({ ok: true });

  const { error } = await db
    .from('membership_member')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', seat.id);
  if (error) return fail(c, 'remove seat', error);

  const { data: orgRow } = await db
    .from('organisation')
    .select('name')
    .eq('id', org.organisation_id)
    .maybeSingle();
  await logMemberActivity(
    ctx.workspaceId,
    seat.person_id,
    'membership_seat_removed',
    `Seat removed · ${orgRow?.name ?? 'organisation'}`,
  );
  await reconcileMemberAccess(seat.id);
  return c.json({ ok: true });
});

// Re-resolve the pricing logic for a member's CURRENT tier/interval and move
// the live subscription onto the new amount from the next period. A new
// Price object is created on the connected account (price_data cannot be
// used on subscription updates); proration_behavior 'none' means the paid
// period runs out untouched.
async function repriceMemberSubscription(
  memberId: string,
): Promise<{ ok: true; amount: number } | { ok: false; error: string }> {
  const stripe = stripeOrNull();
  if (!stripe) return { ok: false, error: 'payments not configured' };
  const { data: m } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, tier_id, country, stripe_subscription_id')
    .eq('id', memberId)
    .maybeSingle();
  if (!m?.stripe_subscription_id) return { ok: false, error: 'no live subscription' };
  const account = await workspaceStripeAccount(m.workspace_id);
  if (!account) return { ok: false, error: 'workspace has no Stripe account' };

  const sub = await stripe.subscriptions.retrieve(m.stripe_subscription_id, {}, { stripeAccount: account });
  const item = sub.items.data[0];
  if (!item) return { ok: false, error: 'subscription has no items' };
  const interval = item.price.recurring?.interval === 'month' ? 'month' : 'year';

  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('price_cents_year, price_cents_month, currency')
    .eq('id', m.tier_id)
    .maybeSingle();
  const base = interval === 'year' ? tier?.price_cents_year : tier?.price_cents_month;
  if (base == null || base <= 0) return { ok: false, error: `tier has no ${interval}ly price` };

  const logic = await priceLogicFor(m.workspace_id, m.tier_id);
  const { pct } = evaluatePriceLogic(logic, { country: m.country, interval });
  const amount = applyPct(base, pct);
  if (amount === item.price.unit_amount) return { ok: true, amount };

  const productId = typeof item.price.product === 'string' ? item.price.product : item.price.product?.id;
  if (!productId) return { ok: false, error: 'could not resolve the Stripe product' };
  const newPrice = await stripe.prices.create(
    {
      product: productId,
      currency: item.price.currency,
      unit_amount: amount,
      recurring: { interval },
    },
    { stripeAccount: account },
  );
  await stripe.subscriptions.update(
    m.stripe_subscription_id,
    { items: [{ id: item.id, price: newPrice.id }], proration_behavior: 'none' },
    { stripeAccount: account },
  );
  return { ok: true, amount };
}

// ---------------------------------------------------------------------------
// Access grants
// ---------------------------------------------------------------------------

membershipRoutes.get('/grants', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_access_grant')
    .select('id, tier_id, product_id, kind, config, created_at, tier:tier_id (name), product:product_id (name)')
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list grants', error);
  // A `thread` grant that no longer lands on a thread says so (additive
  // `problem`): it used to fail quietly in the worker, and the member simply
  // got nothing. The admin sees it beside the grant instead.
  const items = await Promise.all(
    (data ?? []).map(async (g) => {
      if (g.kind !== 'thread') return { ...g, problem: null };
      const r = await resolveGrantThread(ctx.workspaceId, g.config as Record<string, unknown> | null).catch(() => null);
      return { ...g, problem: r && !r.ok ? GRANT_THREAD_PROBLEM[r.reason] : null };
    }),
  );
  return c.json({ items });
});

membershipRoutes.post('/grants', async (c) => {
  const body = CreateGrant.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  // TENANCY, at the write. The schema can say a team_id is a uuid; only a
  // query can say it is one of THIS workspace's teams. Nothing downstream
  // would pay out on a foreign team, but a row that can only ever be wrong
  // should never be stored.
  // TENANCY, at the write, for every kind that names a team: a calendar to
  // discount, or the team a seat lands in. The schema can say a team_id is a
  // uuid; only a query can say it is one of THIS workspace's teams.
  if (body.data.kind === 'team_calendar' || body.data.kind === 'fibre_seat') {
    const teamId = String((body.data.config as { team_id?: unknown }).team_id ?? '');
    // A seat without a team is still a seat; a calendar without one is not a
    // calendar, and its own parser has already refused that.
    if (teamId) {
      const owned = await teamIsInWorkspace(teamId, ctx.workspaceId);
      if (!owned.ok) return c.json({ error: owned.message }, 400);
    }
  }
  // A THREAD grant is checked here and stored by ID: it must land on exactly
  // one thread in this community, or it is refused with the reason — never
  // stored to fail quietly in the worker later. The slug is kept beside the
  // id for showing which thread it is; the id decides.
  if (body.data.kind === 'thread') {
    const r = await resolveGrantThread(ctx.workspaceId, body.data.config);
    if (!r.ok) return c.json({ error: GRANT_THREAD_PROBLEM[r.reason] }, 400);
    body.data.config = { ...body.data.config, thread_id: r.thread.id, thread_slug: r.thread.slug };
  }
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_access_grant')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id')
    .single();
  if (error) return fail(c, 'create grant', error);
  if (body.data.tier_id) void reconcileTierMembers(body.data.tier_id);
  else if (body.data.product_id) void reconcileProductMembers(body.data.product_id);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.delete('/grants/:id', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data: before } = await db
    .from('membership_access_grant')
    .select('tier_id, product_id')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  // Grants aren't personal data — hard delete is fine; the journal rows
  // cascade. Members keep external access until a future sync sweep; v1
  // treats grant removal as configuration, not revocation.
  const { error } = await db.from('membership_access_grant').delete().eq('id', c.req.param('id'));
  if (error) return fail(c, 'delete grant', error);
  if (before?.tier_id) void reconcileTierMembers(before.tier_id);
  else if (before?.product_id) void reconcileProductMembers(before.product_id);
  return c.json({ ok: true });
});

// Approve a parked seat: provisions synchronously — the human clicked, so
// the answer (granted or a concrete error) comes back on the same request.
// Approval IS the consent, so it overrides mode and the billed-seat gate
// (grantSeat still refuses when the plan can neither include nor bill it).
membershipRoutes.post('/access/:id/approve', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const { data: row } = await adminClient
    .from('membership_member_access')
    .select('id, status, grant:access_grant_id (kind, config), member:member_id (id, workspace_id, person_id)')
    .eq('id', c.req.param('id'))
    .maybeSingle();
  const grant = Array.isArray(row?.grant) ? row?.grant[0] : row?.grant;
  const member = Array.isArray(row?.member) ? row?.member[0] : row?.member;
  if (!row || !grant || !member || member.workspace_id !== ctx.workspaceId) {
    return c.json({ error: 'not found' }, 404);
  }
  if (row.status !== 'awaiting_approval') return c.json({ error: 'nothing to approve' }, 409);
  if (grant.kind !== 'fibre_seat') return c.json({ error: 'only seat grants park for approval' }, 400);

  const r = await grantSeat(member.workspace_id, member.person_id, grant.config);
  await adminClient
    .from('membership_member_access')
    .update(
      r.ok
        ? { status: 'granted', external_ref: r.userId, last_error: null, synced_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        : { status: 'error', last_error: r.error, updated_at: new Date().toISOString() },
    )
    .eq('id', row.id);
  return r.ok ? c.json({ ok: true }) : c.json({ error: r.error }, 409);
});

// Retry failed syncs: error rows flip back to the direction the member's
// CURRENT state implies, and the next scheduler tick re-runs them.
membershipRoutes.post('/access/retry', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const { data: errored } = await adminClient
    .from('membership_member_access')
    .select(
      'id, access_grant_id, member:member_id (workspace_id, status, tier_id), grant:access_grant_id (tier_id)',
    )
    .eq('status', 'error');
  let retried = 0;
  for (const row of (errored ?? []) as unknown as {
    id: string;
    member: { workspace_id: string; status: string; tier_id: string } | null;
    grant: { tier_id: string } | null;
  }[]) {
    if (row.member?.workspace_id !== ctx.workspaceId) continue;
    const entitled =
      (row.member.status === 'active' || row.member.status === 'grace') &&
      row.grant?.tier_id === row.member.tier_id;
    await adminClient
      .from('membership_member_access')
      .update({
        status: entitled ? 'pending' : 'revoke_pending',
        last_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', row.id);
    retried += 1;
  }
  return c.json({ retried });
});

// ---------------------------------------------------------------------------
// Pricing rules — the logic builder (§3.9, generalised). One 'price_logic'
// set per (workspace × tier-or-null); declarative rows, first match wins.
// ---------------------------------------------------------------------------

const PriceConditionZ = z.object({
  attr: z.enum(['country', 'interval']),
  op: z.enum(['in', 'not_in']),
  values: z.array(z.string().min(1).max(20)).min(1).max(100),
});
const PriceLogicZ = z.object({
  rules: z
    .array(
      z.object({
        when: PriceConditionZ,
        pct: z.number().min(1).max(1000),
        label: z.string().max(120).optional(),
      }),
    )
    .max(50),
  default_pct: z.number().min(1).max(1000).default(100),
});

membershipRoutes.get('/pricing-rules', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_pricing_rule')
    .select('id, tier_id, kind, config, updated_at, created_at')
    .eq('kind', 'price_logic')
    // Newest first, so a client that takes the first row of a kind takes the
    // one that applies. The page picks with `pickPriceLogicRow` rather than
    // trusting this, but a list handed out in an undefined order is how the
    // bug this fixes got in.
    .order('updated_at', { ascending: false });
  if (error) return fail(c, 'list pricing rules', error);
  return c.json({ items: data ?? [] });
});

membershipRoutes.put('/pricing-rules', async (c) => {
  const body = z
    .object({ tier_id: z.string().uuid().nullable().default(null), config: PriceLogicZ })
    .safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { error } = await db.from('membership_pricing_rule').upsert(
    {
      workspace_id: ctx.workspaceId,
      tier_id: body.data.tier_id,
      kind: 'price_logic',
      config: body.data.config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,kind,tier_id' },
  );
  if (error) return fail(c, 'save pricing rules', error);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Settings (service-role-only table — explicit admin check, token masked)
// ---------------------------------------------------------------------------

membershipRoutes.get('/settings', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const { data, error } = await adminClient
    .from('membership_settings')
    .select('workspace_id, circle_api_token, circle_community_url, google_sa_json, google_admin_email, join_page, fibre_seat_mode, allow_billed_seats, locale, updated_at, directory_visibility, directory_show_contact, directory_show_category, directory_default_category_id, directory_enabled, notify_members')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();
  if (error) return fail(c, 'get settings', error);
  return c.json({
    circle_community_url: data?.circle_community_url ?? null,
    // The token never leaves the API — only whether one is set.
    circle_api_token_set: Boolean(data?.circle_api_token),
    google_configured: Boolean(data?.google_sa_json && data?.google_admin_email),
    google_admin_email: data?.google_admin_email ?? null,
    join_page: data?.join_page ?? {},
    fibre_seat_mode: data?.fibre_seat_mode ?? 'approve',
    allow_billed_seats: data?.allow_billed_seats ?? false,
    locale: toLocale(data?.locale),
    directory_enabled: data?.directory_enabled ?? false,
    directory_visibility: data?.directory_visibility ?? 'everybody',
    directory_show_contact: data?.directory_show_contact ?? false,
    directory_show_category: data?.directory_show_category ?? false,
    directory_default_category_id: data?.directory_default_category_id ?? null,
    // "Tell members about new and changed threads" (lib/member-notify.ts).
    // No row yet = on, the default.
    notify_members: data?.notify_members ?? true,
  });
});

membershipRoutes.put('/settings', async (c) => {
  const body = PutSettings.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  const row: Record<string, unknown> = { workspace_id: ctx.workspaceId, updated_at: new Date().toISOString() };
  if (body.data.circle_api_token !== undefined) row.circle_api_token = body.data.circle_api_token;
  if (body.data.circle_community_url !== undefined) row.circle_community_url = body.data.circle_community_url;
  if (body.data.google_sa_json !== undefined) row.google_sa_json = body.data.google_sa_json;
  if (body.data.google_admin_email !== undefined) row.google_admin_email = body.data.google_admin_email;
  if (body.data.join_page !== undefined) row.join_page = body.data.join_page;
  if (body.data.fibre_seat_mode !== undefined) row.fibre_seat_mode = body.data.fibre_seat_mode;
  if (body.data.allow_billed_seats !== undefined) row.allow_billed_seats = body.data.allow_billed_seats;
  if (body.data.locale !== undefined) row.locale = body.data.locale;
  if (body.data.directory_enabled !== undefined) row.directory_enabled = body.data.directory_enabled;
  if (body.data.directory_visibility !== undefined) row.directory_visibility = body.data.directory_visibility;
  if (body.data.directory_show_contact !== undefined) row.directory_show_contact = body.data.directory_show_contact;
  if (body.data.directory_show_category !== undefined) row.directory_show_category = body.data.directory_show_category;
  if (body.data.notify_members !== undefined) row.notify_members = body.data.notify_members;
  // The default category is the one directory field that names another ROW,
  // and this route runs on adminClient, which RLS does not see — so the
  // tenant boundary here is this check and nothing else. The foreign key
  // cannot help: it proves the category exists, not that it is ours. Without
  // this an admin could point their community's default at a category id
  // belonging to someone else's, which is the exact shape of the two
  // cross-workspace holes found in September 2026 (handbook §2).
  if (body.data.directory_default_category_id !== undefined) {
    const wanted = body.data.directory_default_category_id;
    if (wanted !== null) {
      const { data: cat, error: catErr } = await adminClient
        .from('membership_directory_category')
        .select('id')
        .eq('id', wanted)
        .eq('workspace_id', ctx.workspaceId)
        .maybeSingle();
      if (catErr) return fail(c, 'check default category', catErr);
      if (!cat) return c.json({ error: 'no such category in this community' }, 404);
    }
    row.directory_default_category_id = wanted;
  }
  const { error } = await adminClient
    .from('membership_settings')
    .upsert(row, { onConflict: 'workspace_id' });
  if (error) return fail(c, 'put settings', error);
  return c.json({ ok: true });
});


// ===========================================================================
// THE COMMUNITY PAGE — Members → Settings → Member page (lib/member-page.ts)
//
// The intro and the documents a community's members see in my.thread.
// Admin-only, workspace from the session — never from the body.
// ===========================================================================

const admin = async (c: Context) => {
  const ctx = c.get('ctx');
  return (await isMembershipAdmin(ctx.workspaceId, ctx.userId)) ? ctx.workspaceId : null;
};

membershipRoutes.get('/member-page', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const [page, { data: wsRow }, { data: tiers, error: tErr }] = await Promise.all([
    readMemberPage(ws),
    adminClient.from('workspace').select('name').eq('id', ws).maybeSingle(),
    adminClient.from('membership_tier').select('id, name, archived_at').eq('workspace_id', ws).order('sort_order', { ascending: true }),
  ]);
  if (tErr) return fail(c, 'member page tiers', tErr);
  return c.json({
    // Which community's members see this page. Named in the editor, because
    // with one account in several workspaces the page saves to whichever
    // workspace the session is acting in, and nothing else said which.
    workspace_name: (wsRow?.name as string | undefined) ?? null,
    intro_html: page.intro_html,
    // Per tier (2jj): a section per tier id, and who each document is shown
    // to (empty = every member). The tiers name the editor's choices.
    tier_intros: page.tier_intros,
    tiers: ((tiers ?? []) as { id: string; name: string; archived_at: string | null }[]).map((t) => ({ id: t.id, name: t.name, archived: !!t.archived_at })),
    // The storage path stays on the server.
    documents: page.documents.map((d) =>
      isLink(d)
        ? { id: d.id, title: d.title, kind: 'link', url: d.url, uploaded_at: d.uploaded_at, tier_ids: d.tier_ids ?? [] }
        : { id: d.id, title: d.title, kind: 'file', mime: d.mime, bytes: d.bytes, uploaded_at: d.uploaded_at, tier_ids: d.tier_ids ?? [] },
    ),
  });
});

// The intro as one real member reads it, tags filled — the editor's
// "Preview as …". The first active member by name; nothing is written.
membershipRoutes.get('/member-page/preview', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const { data: rows, error } = await adminClient
    .from('membership_member')
    .select('id, person_id, person:person_id (first_name, last_name, email)')
    .eq('workspace_id', ws)
    .in('status', ['active', 'grace'])
    .is('deleted_at', null)
    .limit(200);
  if (error) return fail(c, 'preview member', error);
  type Row = { id: string; person_id: string; person: { first_name?: string | null; last_name?: string | null; email?: string | null } | null };
  const label = (r: Row) => [r.person?.first_name, r.person?.last_name].filter(Boolean).join(' ') || r.person?.email || '';
  const pick = ((rows ?? []) as unknown as Row[]).sort((a, b) => label(a).localeCompare(label(b)))[0];
  if (!pick) return c.json({ member_name: null, intro_html: null });
  const view = await communityView({ workspace_id: ws, person_id: pick.person_id, member_id: pick.id });
  return c.json({ member_name: label(pick), intro_html: view.intro_html, tier_sections: view.tier_sections });
});

// A link entry: title + an http(s) address (lib/member-page.ts safeLinkUrl).
membershipRoutes.post('/member-page/links', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const body = (await c.req.json().catch(() => null)) as { url?: unknown; title?: unknown } | null;
  const r = await addLink(ws, body?.url, typeof body?.title === 'string' ? body.title : null);
  if (r === 'bad_url') return c.json({ error: 'Use a full web address starting with https:// (or http://).' }, 400);
  return c.json({ id: r.id, title: r.title, kind: 'link', url: r.url, uploaded_at: r.uploaded_at }, 201);
});

membershipRoutes.put('/member-page', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const body = (await c.req.json().catch(() => null)) as { intro_html?: unknown } | null;
  if (!body || (body.intro_html !== null && typeof body.intro_html !== 'string')) {
    return c.json({ error: 'intro_html must be a string or null' }, 400);
  }
  if (typeof body.intro_html === 'string' && body.intro_html.length > 100_000) {
    return c.json({ error: 'the intro is too long' }, 400);
  }
  await saveIntro(ws, body.intro_html as string | null);
  return c.json({ ok: true });
});

membershipRoutes.post('/member-page/documents', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const form = await c.req.parseBody();
  const file = form.file;
  if (!(file instanceof File)) return c.json({ error: 'multipart field "file" required' }, 400);
  const title = typeof form.title === 'string' ? form.title : null;
  const r = await addDocument(ws, { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) }, title);
  if (r === 'too_large') return c.json({ error: 'Files up to 10 MB.' }, 400);
  if (r === 'not_allowed') return c.json({ error: 'PDF, PNG, JPEG or WebP only.' }, 400);
  if (r === 'empty') return c.json({ error: 'That file is empty.' }, 400);
  if (r === 'corrupt') return c.json({ error: 'That file looks damaged or incomplete. Export it again and retry.' }, 400);
  return c.json({ id: r.id, title: r.title, kind: 'file', mime: r.mime, bytes: r.bytes, uploaded_at: r.uploaded_at }, 201);
});

membershipRoutes.patch('/member-page/documents/:id', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const body = (await c.req.json().catch(() => null)) as { title?: unknown } | null;
  if (typeof body?.title !== 'string' || !body.title.trim()) return c.json({ error: 'title is required' }, 400);
  return (await renameDocument(ws, c.req.param('id'), body.title))
    ? c.json({ ok: true })
    : c.json({ error: 'not found' }, 404);
});

// Every id must be a tier of THIS workspace — another community's tier id
// is refused, never stored.
const tiersOfWorkspace = async (ws: string, ids: string[]): Promise<boolean> => {
  if (!ids.length) return true;
  const { data, error } = await adminClient.from('membership_tier').select('id').eq('workspace_id', ws).in('id', ids);
  if (error) throw new Error(`tiers: ${error.message}`);
  return new Set((data ?? []).map((t) => t.id as string)).size === new Set(ids).size;
};
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);

// One tier's section of the page (2jj). Null or empty removes it.
membershipRoutes.put('/member-page/tier-intros/:tierId', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const tierId = c.req.param('tierId');
  const body = (await c.req.json().catch(() => null)) as { intro_html?: unknown } | null;
  if (!body || (body.intro_html !== null && typeof body.intro_html !== 'string')) {
    return c.json({ error: 'intro_html must be a string or null' }, 400);
  }
  if (typeof body.intro_html === 'string' && body.intro_html.length > 100_000) {
    return c.json({ error: 'the intro is too long' }, 400);
  }
  if (!isUuid(tierId) || !(await tiersOfWorkspace(ws, [tierId]))) return c.json({ error: 'That tier is not one of this community’s.' }, 400);
  await saveTierIntro(ws, tierId, body.intro_html as string | null);
  return c.json({ ok: true });
});

// Who one document is shown to: tier ids, or [] for every member (2jj).
membershipRoutes.put('/member-page/documents/:id/tiers', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const body = (await c.req.json().catch(() => null)) as { tier_ids?: unknown } | null;
  if (!Array.isArray(body?.tier_ids) || !body.tier_ids.every(isUuid)) {
    return c.json({ error: 'tier_ids must be an array of tier ids' }, 400);
  }
  const ids = body.tier_ids as string[];
  if (!(await tiersOfWorkspace(ws, ids))) return c.json({ error: 'That tier is not one of this community’s.' }, 400);
  return (await setDocumentTiers(ws, c.req.param('id'), ids)) ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

membershipRoutes.put('/member-page/documents/order', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  const body = (await c.req.json().catch(() => null)) as { ids?: unknown } | null;
  if (!Array.isArray(body?.ids) || !body.ids.every((x) => typeof x === 'string')) {
    return c.json({ error: 'ids must be an array of document ids' }, 400);
  }
  await reorderDocuments(ws, body.ids as string[]);
  return c.json({ ok: true });
});

membershipRoutes.delete('/member-page/documents/:id', async (c) => {
  const ws = await admin(c);
  if (!ws) return c.json({ error: 'admin only' }, 403);
  return (await removeDocument(ws, c.req.param('id'))) ? c.body(null, 204) : c.json({ error: 'not found' }, 404);
});

// ===========================================================================
// HELD THREADS — GET /notify-held, POST /notify-held/announce|dismiss
//
// More than 20 threads newly on a calendar in one pass are held rather than
// announced (lib/member-notify.ts, the circuit breaker): far likelier an
// import than a sitting, and an announcement cannot be taken back. But a
// sitting it can be — an organiser loading a year — so the decision is an
// admin's: tell members now, as one digest, or don't.
// ===========================================================================

membershipRoutes.get('/notify-held', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  try {
    return c.json({ items: await heldThreads(ctx.workspaceId) });
  } catch (e) {
    console.error('[membership/notify-held]', e);
    return c.json({ error: 'could not read the held threads' }, 500);
  }
});

membershipRoutes.post('/notify-held/announce', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  try {
    return c.json({ ok: true, ...(await announceHeld(ctx.workspaceId)) });
  } catch (e) {
    console.error('[membership/notify-held/announce]', e);
    return c.json({ error: 'could not announce them — nothing was sent' }, 500);
  }
});

membershipRoutes.post('/notify-held/dismiss', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) {
    return c.json({ error: 'admin only' }, 403);
  }
  try {
    return c.json({ ok: true, dismissed: await dismissHeld(ctx.workspaceId) });
  } catch (e) {
    console.error('[membership/notify-held/dismiss]', e);
    return c.json({ error: 'could not dismiss them' }, 500);
  }
});

// ===========================================================================
// MEMBER DIRECTORY — categories (docs/member-directory-spec.md slice 1).
//
// A category is the workspace's own vocabulary. A PRODUCT carries categories;
// a member's categories are the union over what they hold; directory
// visibility follows from that, so nobody administers a list of who may see
// whom.
//
// A category is NOT a tier and must not be named after one: shown beside a
// member it discloses which product they hold, and a product has a price.
// That is why `directory_show_category` defaults false.
//
// userClient throughout — RLS does the scoping (20261002170643), the same way
// the product routes above work. Nothing here reads a person.
// ===========================================================================

const CreateCategory = z.object({
  name: z.string().trim().min(1).max(80),
  sort_order: z.number().int().optional(),
});
const PatchCategory = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  sort_order: z.number().int().optional(),
  archived: z.boolean().optional(),
});

membershipRoutes.get('/directory/categories', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_directory_category')
    .select('id, name, sort_order, archived_at, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) return fail(c, 'list categories', error);
  const includeArchived = c.req.query('archived') === 'true';
  return c.json({ items: (data ?? []).filter((r) => includeArchived || !r.archived_at) });
});

membershipRoutes.post('/directory/categories', async (c) => {
  const body = CreateCategory.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_directory_category')
    .insert({ ...body.data, workspace_id: ctx.workspaceId })
    .select('id')
    .single();
  // The unique index is case-insensitive per workspace: "Fellows" and
  // "fellows" are one category typed twice, and a member filtered by the
  // wrong one is invisible. Say so rather than returning a raw 23505.
  if (error?.code === '23505') {
    return c.json({ error: 'a category with that name already exists' }, 409);
  }
  if (error) return fail(c, 'create category', error);
  return c.json({ id: data.id }, 201);
});

membershipRoutes.patch('/directory/categories/:id', async (c) => {
  const body = PatchCategory.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { archived, ...rest } = body.data;
  const patch: Record<string, unknown> = { ...rest };
  if (archived !== undefined) patch.archived_at = archived ? new Date().toISOString() : null;
  const { error } = await db
    .from('membership_directory_category')
    .update(patch)
    .eq('id', c.req.param('id'));
  if (error?.code === '23505') {
    return c.json({ error: 'a category with that name already exists' }, 409);
  }
  if (error) return fail(c, 'patch category', error);
  return c.json({ ok: true });
});

// Which categories a product confers. Replace-in-full rather than add/remove
// one at a time: the editor shows a set of checkboxes and saves a set, and a
// per-item API would make the screen and the data disagree halfway through.
const SetProductCategories = z.object({
  category_ids: z.array(z.string().uuid()).max(20),
});

membershipRoutes.get('/products/:id/categories', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_product_category')
    .select('category_id')
    .eq('product_id', c.req.param('id'));
  if (error) return fail(c, 'list product categories', error);
  return c.json({ category_ids: (data ?? []).map((r) => r.category_id as string) });
});

membershipRoutes.put('/products/:id/categories', async (c) => {
  const body = SetProductCategories.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const productId = c.req.param('id');

  // Delete-then-insert under the caller's own RLS. The insert policy requires
  // BOTH the product and every category to belong to this workspace, so a
  // crafted category id from another community is refused by the database
  // rather than by a check here that could be forgotten.
  const { error: delErr } = await db
    .from('membership_product_category')
    .delete()
    .eq('product_id', productId);
  if (delErr) return fail(c, 'clear product categories', delErr);

  const wanted = [...new Set(body.data.category_ids)];
  if (wanted.length) {
    const { error: insErr } = await db
      .from('membership_product_category')
      .insert(wanted.map((category_id) => ({ product_id: productId, category_id })));
    if (insErr) return fail(c, 'set product categories', insErr);
  }
  return c.json({ ok: true, count: wanted.length });
});

/** Every product->category link in the workspace, in one read.
 *
 *  The products screen loads all of them and filters per product in the
 *  client, which is how the GRANTS screen beside it already works — the
 *  alternative is one request per product dialog opened, for a table that
 *  holds a handful of rows per community. RLS scopes it. */
membershipRoutes.get('/directory/product-categories', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const { data, error } = await db
    .from('membership_product_category')
    .select('product_id, category_id');
  if (error) return fail(c, 'list product category links', error);
  return c.json({ items: data ?? [] });
});

/** How many products carry no category — the number the admin screen shows.
 *
 *  §9.3: when `directory_default_category_id` is unset, a member holding only
 *  uncategorised products is NOT listed and sees nobody. That fails closed,
 *  which is right, and it is silent, which is not. A member missing from a
 *  list is the empty that reads as working, so the count is the feature. */
membershipRoutes.get('/directory/uncategorised-products', async (c) => {
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const [products, links] = await Promise.all([
    db.from('membership_product').select('id, name').is('archived_at', null),
    db.from('membership_product_category').select('product_id'),
  ]);
  if (products.error) return fail(c, 'list products for count', products.error);
  if (links.error) return fail(c, 'list links for count', links.error);
  const linked = new Set((links.data ?? []).map((r) => r.product_id as string));
  const items = (products.data ?? []).filter((p) => !linked.has(p.id as string));
  return c.json({ count: items.length, items });
});

// ===========================================================================
// PUBLIC surface — the join page (no auth; adminClient with explicit
// workspace scoping throughout, the /thread/public pattern).
// ===========================================================================

const MEMBERSHIP_APP_URL =
  process.env.MEMBERSHIP_APP_URL ?? appUrl('membership', process.env);

// The workspace must have the app activated for its join page to exist.
async function publicWorkspace(slug: string): Promise<{ id: string; slug: string; name: string } | null> {
  const { data: ws } = await adminClient
    .from('workspace')
    .select('id, slug, name')
    .eq('slug', slug)
    .maybeSingle();
  if (!ws) return null;
  const app = await appId();
  if (!app) return null;
  const { data: wa } = await adminClient
    .from('workspace_app')
    .select('id')
    .eq('workspace_id', ws.id)
    .eq('app_id', app)
    .is('deactivated_at', null)
    .maybeSingle();
  return wa ? ws : null;
}

// GET /public/vat-quote?workspace_slug=&country=&vat_id= — what VAT a buyer
// would pay on top, by THE rule the checkout charges by (lib/sale-vat.ts).
// The panel multiplies its own net figures by `rate_pct`; Stripe applies the
// same rate per line. A rate, not an amount, so nothing priced is trusted
// from the browser.
membershipRoutes.get('/public/vat-quote', async (c) => {
  const ws = await publicWorkspace(c.req.query('workspace_slug') ?? '');
  if (!ws) return c.json({ error: 'not found' }, 404);
  const country = (c.req.query('country') ?? '').trim().toUpperCase();
  const vatId = (c.req.query('vat_id') ?? '').trim().slice(0, 30) || null;
  const v = await saleVat({ workspaceId: ws.id, net_cents: 10000, country: /^[A-Z]{2}$/.test(country) ? country : null, vat_id: vatId });
  const registered = !!(await resolveSellerVat(ws.id));
  return c.json({
    applies: registered,
    rate_pct: v.rate_pct,
    label: v.label,
    reverse_charge: v.reverse_charge,
    needs_country: registered && !/^[A-Z]{2}$/.test(country),
  });
});

membershipRoutes.get('/public/catalog/:workspaceSlug', async (c) => {
  const ws = await publicWorkspace(c.req.param('workspaceSlug'));
  if (!ws) return c.json({ error: 'not found' }, 404);

  // ONE TIER BY ID — the direct link to a hidden tier (2026-10-14).
  //
  // A hidden tier is absent from the list by design, so the join page has no
  // way to learn of it from the catalogue; `?tier=<id>` is how an invitation
  // names it. Served by THIS handler rather than an endpoint of its own, on
  // purpose: everything below — the included/optional product split, the
  // directory categories, the resolved terms, the price logic — would
  // otherwise exist twice, and the day the two copies disagree is the day a
  // hidden tier charges or promises something the listed ones do not. One
  // shaping, two ways in.
  //
  // The uuid is checked before it reaches PostgREST, which answers a 400 for
  // a malformed one and would turn a mistyped link into an error page.
  const askedTier = c.req.query('tier') ?? null;
  if (askedTier && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(askedTier)) {
    return c.json({ error: 'not found' }, 404);
  }

  // WHICH TIERS BELONG ON THE PAGE. Asked for by id: exactly that one,
  // hidden or not — that is what the direct link is for. Otherwise the listed
  // ones only.
  //
  // `archived_at` and `workspace_id` apply in BOTH branches, and both matter.
  // Hidden means "not advertised"; archived means "finished", and a link to a
  // finished tier must not sell it — that is the one rule a direct link does
  // not get to bypass. The workspace filter is what stops a link carrying
  // another community's tier id into this community's join page.
  const tierQuery = adminClient
    .from('membership_tier')
    // `first_period_ends_on` is additive (rule 8) and is here for ONE
    // reason: the panel charges a full year under it and could not say so.
    // The launch-cohort rule (@thefibre/shared/fixed-renewal) takes the whole first
    // year up front and renews on a fixed date, and the only place that was
    // visible was the Stripe receipt — after paying. "Nobody is asked for
    // money before they have agreed to anything" (v1.173.0) is not only
    // about the terms box; it is about the amount and the date too.
    //
    // `hidden` is additive too, and the page reads it to say "this tier is
    // not listed" beside a tier reached by its link.
    .select(
      'id, name, description, characteristics, price_cents_year, price_cents_month, currency, sort_order, first_period_ends_on, hidden, price_includes_vat, membership_tier_product ( product_id, optional )',
    )
    .eq('workspace_id', ws.id)
    .is('archived_at', null)
    .order('sort_order', { ascending: true });

  const [{ data: tiers }, { data: products }, { data: settings }] = await Promise.all([
    askedTier ? tierQuery.eq('id', askedTier) : tierQuery.eq('hidden', false),
    adminClient
      .from('membership_product')
      // price/purchasable are additive (à-la-carte, 2026-09-06): the page
      // shows a Buy button only for purchasable products with a price.
      .select('id, name, description, characteristics, price_cents, currency, purchasable, links, sort_order, price_interval, group_id, price_includes_vat')
      .eq('workspace_id', ws.id)
      .is('archived_at', null)
      .order('sort_order', { ascending: true }),
    adminClient
      .from('membership_settings')
      .select('join_page, circle_community_url, locale')
      .eq('workspace_id', ws.id)
      .maybeSingle(),
  ]);

  // THE SAME LOGIC THE CHARGE WILL USE, per tier.
  //
  // This asked for the workspace-wide rule (`tier_id` null) while
  // `/public/validate-code` and `/public/join` both ask for the TIER's —
  // `priceLogicFor(ws.id, tier.id)`, which prefers a tier-specific rule over
  // the general one. So a tier with its own rule was priced one way on the
  // page and another at the till.
  //
  // Latent, because the admin UI only ever writes `tier_id: null` today. But
  // `PUT /pricing-rules` accepts a tier id, so the shape that breaks it is
  // reachable through the published API, and "nobody has done it yet" is not
  // a property worth relying on where money is concerned.
  //
  // `price_logic` stays on the response, unchanged, as the workspace default
  // — removing it would break a caller (rule 8). Each tier now also carries
  // its own, additively, and the panel prefers it.
  const priceLogic = await priceLogicFor(ws.id, null);
  const tierLogic = new Map(
    await Promise.all(
      (tiers ?? []).map(
        async (t) => [t.id as string, await priceLogicFor(ws.id, t.id as string)] as const,
      ),
    ),
  );

  // WHICH DIRECTORY CATEGORIES EACH TIER CONFERS. The join form's consent
  // checkbox names them ("Show me in Facilitators"), and a category reaches a
  // member through the products their tier includes — never directly. Live
  // categories only: an archived one is not something to promise.
  const categoryByProduct = new Map<string, string[]>();
  {
    const { data: links } = await adminClient
      .from('membership_product_category')
      .select('product_id, category:category_id (name, archived_at)')
      .in('product_id', (products ?? []).map((p) => p.id as string));
    for (const l of links ?? []) {
      const cat = (Array.isArray(l.category) ? l.category[0] : l.category) as
        | { name: string; archived_at: string | null }
        | null;
      if (!cat || cat.archived_at) continue;
      const list = categoryByProduct.get(l.product_id as string) ?? [];
      list.push(cat.name);
      categoryByProduct.set(l.product_id as string, list);
    }
  }

  // WHOSE TERMS. The join form has to link them before anybody pays, and
  // only the API knows whether this workspace set its own (additive field).
  const { data: wsTerms } = await adminClient
    .from('workspace')
    .select('terms_url')
    .eq('id', ws.id)
    .maybeSingle();
  const terms = resolveTerms(wsTerms?.terms_url);

  return c.json({
    workspace: { slug: ws.slug, name: ws.name },
    // The join page's default language (additive — rule 8).
    locale: toLocale(settings?.locale),
    // The terms a joiner must accept: where they are, and whether they are
    // this community's own or The Thread's standard ones.
    terms: { url: terms.url, standard: terms.standard },
    price_logic: priceLogic,
    // Additive (2026-10-15): prices are EXCL. VAT, and a VAT-registered
    // community adds it by the buyer's country — so the page asks for the
    // country and shows excl. / VAT / total (GET /public/vat-quote).
    vat_registered: !!(await resolveSellerVat(ws.id)),
    // Additive (2026-10-16): the rate a buyer pays before saying where they
    // are — the seller's HOME rate, by THE rule (saleVat with no country).
    // The cards show "€363 incl. 21% VAT" with it; null when no VAT is added.
    vat_home_rate_pct: (await saleVat({ workspaceId: ws.id, net_cents: 10000, country: null })).rate_pct || null,
    tiers: (tiers ?? []).map((t) => ({
      ...t,
      // Included vs optional split (the tick-box add-ons) — the admin GET got
      // this in v0.47.0; the public catalog was missed until the browser
      // tour caught optional products listed under "Includes" (2026-09-07).
      product_ids: (t.membership_tier_product ?? [])
        .filter((l: { optional?: boolean }) => !l.optional)
        .map((l: { product_id: string }) => l.product_id),
      optional_product_ids: (t.membership_tier_product ?? [])
        .filter((l: { optional?: boolean }) => l.optional)
        .map((l: { product_id: string }) => l.product_id),
      // The categories this tier confers, named, deduplicated and in a stable
      // order — two products of one tier may carry the same category, and a
      // sentence listing it twice reads like a mistake.
      directory_categories: [
        ...new Set(
          (t.membership_tier_product ?? [])
            .filter((l: { optional?: boolean }) => !l.optional)
            .flatMap((l: { product_id: string }) => categoryByProduct.get(l.product_id) ?? []),
        ),
      ].sort(),
      // Additive (rule 8): the rule that will actually price THIS tier.
      price_logic: tierLogic.get(t.id as string) ?? null,
      membership_tier_product: undefined,
    })),
    products: products ?? [],
    // Additive (2026-10-16): the community's product groups, in their order —
    // the page puts a heading over each group's products (group_id on each
    // product); ungrouped ones go last, under no heading.
    product_groups:
      (
        await adminClient
          .from('membership_product_group')
          .select('id, name')
          .eq('workspace_id', ws.id)
          .is('archived_at', null)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true })
      ).data ?? [],
    join_page: settings?.join_page ?? {},
  });
});

// POST /api/v1/membership/public/validate-code — what a typed code does to
// this tier's price, answered BY THE SERVER.
//
// The same shape as Thread's /public/validate-coupon and for the same reason:
// the join form needs to show somebody what they will pay before they commit,
// and the number it shows must come from the place that will actually charge
// them. The panel's figure is a courtesy; the join route validates the code
// again from scratch and ignores whatever the form believed.
//
// It answers 200 with `valid: false` rather than a 4xx for an unknown code —
// a wrong code is an ordinary thing a person does, not an error, and a 400
// makes a form shout where it should simply say "that code is not valid".
const ValidateCode = z.object({
  workspace_slug: z.string().min(1).max(100),
  tier_id: z.string().uuid(),
  interval: z.enum(['year', 'month']).default('year'),
  code: z.string().min(1).max(60),
  // Self-declared, as on the join: the country decides the base price before
  // any code applies, so the two are evaluated together or the discount comes
  // off the wrong number.
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
});

membershipRoutes.post('/public/validate-code', async (c) => {
  const body = ValidateCode.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const d = body.data;

  const ws = await publicWorkspace(d.workspace_slug);
  if (!ws) return c.json({ valid: false, reason: 'not found' });

  // RATE-LIMITED, because this answers "does this code exist" to anybody who
  // asks. Codes are short and human — SUMMER25 is the kind of thing people
  // write — so an unlimited oracle is a guessing machine, and the thing being
  // guessed is money.
  //
  // By IP AND workspace: by IP alone, one office behind one address locks
  // itself out of every community at once; by workspace alone, one attacker
  // locks out that community's real joiners. Both together bound the guessing
  // without either failure mode. 20 an hour is generous for somebody who has
  // a code and mistyped it, and useless for somebody who does not.
  //
  // The messages stay specific ("this code has expired" rather than "not
  // valid") — knowing a code EXISTS is a small leak, and sending somebody
  // hunting for a typo in a code that was simply out of date is a certain
  // cost to a real person. The limiter is the defence; the wording is not.
  // `clientIp`, NOT x-forwarded-for read here. Behind Fly a client can send
  // its own X-Forwarded-For and its first entry is whatever they typed, so
  // rotating that header would have bought unlimited guesses — a limiter
  // keyed on a value the attacker chooses is not a limiter. The helper
  // prefers Fly-Client-IP, which the edge sets and a client cannot forge,
  // and lib/rate-limit.test.ts holds it to that.
  const gate = hit(`membership-code:${ws.id}:${clientIp(c.req.raw.headers)}`, 20, 3_600_000);
  if (!gate.allowed) {
    c.header('Retry-After', String(gate.resetSeconds));
    return c.json({ valid: false, reason: 'too many attempts, try again later' }, 429);
  }

  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('id, price_cents_year, price_cents_month, currency, price_includes_vat')
    .eq('id', d.tier_id)
    .eq('workspace_id', ws.id)
    .is('archived_at', null)
    .maybeSingle();
  if (!tier) return c.json({ valid: false, reason: 'not found' });

  const base = d.interval === 'year' ? tier.price_cents_year : tier.price_cents_month;
  if (base == null || base <= 0) {
    return c.json({ valid: false, reason: `this tier has no ${d.interval}ly price` });
  }

  // The country rules first, the code second — a discount comes off what this
  // person would otherwise pay, not off the list price.
  const logic = await priceLogicFor(ws.id, tier.id);
  const { pct } = evaluatePriceLogic(logic, {
    country: d.country?.toUpperCase() ?? null,
    interval: d.interval,
  });
  const afterCountry = applyPct(base, pct);

  const found = await findDiscountCode(ws.id, d.code, { kind: 'tier', id: tier.id });
  if ('error' in found) return c.json({ valid: false, reason: found.error });

  // FIRST PERIOD ONLY (decided 2026-10-13). The discount is what the first
  // payment becomes; the membership renews at the full price, and the panel
  // says both numbers out loud rather than letting somebody discover the
  // second one a year later.
  // NET figures, as the basket shows its lines: for a price entered incl.
  // VAT the code comes off the ENTERED price, then the net is derived.
  const incl = (tier as { price_includes_vat?: boolean }).price_includes_vat;
  const country_ = d.country?.toUpperCase() ?? null;
  return c.json({
    valid: true,
    code: found.code.code,
    price_cents: await chargeNet({ workspaceId: ws.id, enteredCents: discountedPrice(found.code, afterCountry), includesVat: incl, country: country_ }),
    full_price_cents: await chargeNet({ workspaceId: ws.id, enteredCents: afterCountry, includesVat: incl, country: country_ }),
    currency: tier.currency ?? 'EUR',
  });
});

const PublicJoin = z.object({
  workspace_slug: z.string().min(1).max(100),
  tier_id: z.string().uuid(),
  interval: z.enum(['year', 'month']).default('year'),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  // SELF-DECLARED country (§3.9 D1) — drives the pricing logic. Optional:
  // no country matches no country-rule, so the default pct applies.
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  // UI hint: the language the visitor joined in. Invalid values are ignored
  // (never a 400) — the workspace default applies instead.
  locale: z.string().max(10).optional(),
  // Optional add-on products ticked on the join page. Validated server-side
  // against the tier's OPTIONAL links; capped so the ids fit Stripe's
  // 500-char metadata value (10 × 36 + commas = 369).
  option_product_ids: z.array(z.string().uuid()).max(10).default([]),
  // "Show me in …" — the directory checkbox on the join form (2026-10-13).
  // DEFAULT FALSE, and absent means false: appearing in a directory is a
  // consent, and a consent that arrives by omission is not one.
  directory_listed: z.boolean().default(false),
  // THE TERMS. Required — literally: `.refine` below refuses the join
  // without it, rather than defaulting it to false and charging anyway.
  // Sjoerd, testing the join: "Nowhere, I have accepted terms and
  // conditions." Nobody is asked for money before they have agreed.
  terms_accepted: z.boolean().default(false),
  // THE INVOICING DETAILS, asked HERE rather than on Stripe's page (Sjoerd,
  // 2026-10-13: "nothing of Stripe is the rule, except payment", and "it
  // should be a single point,,, invoicing payments"). The same schema the
  // enrol form posts, and the same shared fields collect it.
  //
  // Every field is optional, including the address: somebody joining as
  // themselves with a card needs to type nothing here, and a form that
  // demands a company name from an individual is a form that loses them.
  // What arrives is used; what does not is asked for by Stripe instead
  // (billing_address_collection 'auto' leaves that decision to the payment
  // method, which is where it belongs).
  billing: BillingFields.optional(),
  // A discount code, as TYPED. Never a price: the amount is decided here,
  // from the code, every time. The panel showed somebody a number as a
  // courtesy and this ignores it.
  code: z.string().min(1).max(60).optional(),
  request_id: z.string().min(8).max(100),
}).refine((v) => v.terms_accepted === true, {
  path: ['terms_accepted'],
  message: 'the terms and conditions must be accepted before paying',
});

// The workspace's plan fee, as Stripe wants it for subscriptions: a percent.
// The fixed cap from lib/fees.ts cannot apply — application_fee_amount does
// not exist in subscription mode (documented in the proposal §3.3).
export async function platformFeePercent(workspaceId: string): Promise<number> {
  try {
    const { data: feeRows } = await adminClient.rpc('workspace_meet_fee', { ws_id: workspaceId });
    const row = Array.isArray(feeRows) ? (feeRows[0] as { pct: number | string } | undefined) : null;
    if (row) {
      const pct = typeof row.pct === 'string' ? parseFloat(row.pct) : row.pct;
      if (Number.isFinite(pct)) return Math.round(pct * 100 * 100) / 100; // 0.02 → 2
    }
  } catch (e) {
    console.warn('[membership] fee lookup failed, defaulting to 2%', e);
  }
  return 2;
}

membershipRoutes.post('/public/join', async (c) => {
  const body = PublicJoin.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const d = body.data;
  const email = d.email.trim().toLowerCase();

  const ws = await publicWorkspace(d.workspace_slug);
  if (!ws) return c.json({ error: 'not found' }, 404);

  // The visitor's language: a validated UI hint (invalid → ignored). The
  // resolved value rides the redirect (lang=…) and, when new, the member row.
  const joinLocale = isLocale(d.locale) ? d.locale : null;
  const resolvedLocale = joinLocale ?? (await memberEmailLocale(ws.id, null));

  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);
  const account = await workspaceStripeAccount(ws.id);
  if (!account) {
    return c.json({ error: 'This community has not connected payments yet.' }, 503);
  }

  // BY ID, IN THIS WORKSPACE, NOT ARCHIVED — and deliberately NOT filtered on
  // `hidden`.
  //
  // A hidden tier (2026-10-14) is one that is not advertised on the join page
  // but is still sold, by invitation, through a direct link. This route is
  // reached with the tier's id, which is exactly the authority that link
  // carries, so refusing a hidden tier here would make the feature useless:
  // the link would open a page that could not be joined. Please do not add
  // `.eq('hidden', false)` as a tidy-up.
  //
  // The two filters that DO matter are both here. `workspace_id` stops a tier
  // id from one community being joined through another's page, and
  // `archived_at` stops a stale link selling a tier that has been retired —
  // that is the difference between hidden and archived, and it is the one
  // thing a direct link does not get to bypass.
  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('id, name, price_cents_year, price_cents_month, currency, first_period_ends_on, price_includes_vat')
    .eq('id', d.tier_id)
    .eq('workspace_id', ws.id)
    .is('archived_at', null)
    .maybeSingle();
  if (!tier) return c.json({ error: 'tier not found' }, 404);
  const baseAmount = d.interval === 'year' ? tier.price_cents_year : tier.price_cents_month;
  if (baseAmount == null || baseAmount <= 0) {
    return c.json({ error: `This tier has no ${d.interval}ly price.` }, 400);
  }
  // Pricing logic (§3.9): evaluated SERVER-SIDE — the join page preview is
  // a courtesy, this number is the charge.
  const country = d.country?.toUpperCase() ?? null;
  const logic = await priceLogicFor(ws.id, tier.id);
  const { pct, matched } = evaluatePriceLogic(logic, { country, interval: d.interval });
  const enteredList = applyPct(baseAmount, pct);
  // "Price includes VAT" (2026-10-16): the logic and the code act on the
  // ENTERED price; what is charged from here on is its NET (chargeNet).
  const tierIncl = (tier as { price_includes_vat?: boolean }).price_includes_vat;
  const listAmount = await chargeNet({ workspaceId: ws.id, enteredCents: enteredList, includesVat: tierIncl, country, vat_id: d.billing?.tax_no ?? null });
  if (listAmount <= 0) {
    return c.json({ error: 'This price resolves to zero — check the pricing rules.' }, 400);
  }

  // THE CODE, LOOKED UP AGAIN. The panel validated it to show a number; this
  // is the number that will be charged, so it is decided here from the code
  // alone. A code that has expired or been used up in the seconds between is
  // refused rather than honoured — and refused LOUDLY, because somebody who
  // typed a code and saw a price must not be charged a different one without
  // being told.
  //
  // FIRST PERIOD ONLY (decided 2026-10-13): `amount` is what is collected now
  // and `listAmount` is what the membership renews at. The two differ only
  // when a code applied, and the panel says both out loud.
  let discount: Awaited<ReturnType<typeof findDiscountCode>> | null = null;
  if (d.code) {
    // THE BUCKET IS CHECKED BEFORE THE LOOKUP, AND SPENT ONLY ON A FAILURE.
    //
    // Charging only failures is the right intent — this route takes money,
    // and a group joining from one office wifi must never hit a wall. But
    // checking only on failure leaks: once the bucket is empty a wrong guess
    // gets a 429 and a RIGHT one sails through to a 200 with a Checkout URL,
    // so the status code itself answers "is this code valid" at full speed
    // and with a perfect signal. Refusing on exhaustion regardless of the
    // answer is what closes that.
    //
    // A request carrying no code never reaches here at all.
    const codeKey = `membership-code:${ws.id}:${clientIp(c.req.raw.headers)}`;
    if (isExhausted(codeKey, 20)) {
      c.header('Retry-After', String(resetSecondsFor(codeKey)));
      return c.json({ error: 'too many attempts, try again later' }, 429);
    }
    discount = await findDiscountCode(ws.id, d.code, { kind: 'tier', id: tier.id });
    if ('error' in discount) {
      // A wrong code costs one from the SAME bucket as /public/validate-code:
      // one question, one budget, or two twenty-an-hour limits are forty.
      hit(codeKey, 20, 3_600_000);
      return c.json({ error: discount.error, code_invalid: true }, 400);
    }
  }
  const amount =
    discount && 'code' in discount
      ? await chargeNet({ workspaceId: ws.id, enteredCents: discountedPrice(discount.code, enteredList), includesVat: tierIncl, country, vat_id: d.billing?.tax_no ?? null })
      : listAmount;

  // The terms this person is agreeing to, resolved once and carried to the
  // consent record. The form showed them the same ones (the catalogue says
  // which), but the API decides what is recorded — a form could say anything.
  const { data: wsRow } = await adminClient
    .from('workspace')
    .select('terms_url')
    .eq('id', ws.id)
    .maybeSingle();
  const joinTerms = resolveTerms(wsRow?.terms_url);

  // THE LAUNCH COHORT. While the tier's first_period_ends_on is in the future,
  // this join pays the whole period NOW as a one-off line and the subscription
  // starts billing the day after that date — Sjoerd: "they have to pay for the
  // past year (2026) and runs up 31/12/2026". A past date is inert, so
  // ordinary joins (and every join after the launch) keep anniversary billing
  // without anybody switching anything off.
  const fixedPeriod = fixedFirstPeriod(
    (tier as { first_period_ends_on?: string | null }).first_period_ends_on,
    new Date(),
    // The interval decides too: on a monthly join "the full period now" is one
    // month, which would hand the cohort the rest of the year for a month's
    // price. The rule refuses it; the route does not have to know why.
    d.interval,
  );

  // Auto-account (the Thread enrol pattern): email-only, verify at sign-in.
  try {
    const { data: hasAccount } = await adminClient.rpc('auth_user_exists', { p_email: email });
    if (hasAccount !== true) {
      await adminClient.auth.admin.createUser({ email, email_confirm: true });
    }
  } catch (e) {
    console.warn('[membership/public/join] account auto-create failed', e);
  }

  // Create-or-match the person via the platform SPoT. The old .ilike() match
  // here treated % and _ in the ADDRESS as wildcards — and _ is legal in an
  // address — so foo_bar@x.com could match fooXbar@x.com. email is citext, so
  // resolvePerson's .eq() is already case-insensitive and cannot wildcard.
  const resolved = await resolvePerson({
    workspaceId: ws.id,
    email,
    name: d.name,
    source: 'membership_join',
    create: true,
    // The person typing is the person named: an existing nameless contact
    // gets the name, a named one keeps theirs (2026-10-15).
    fillEmptyName: true,
  });
  await fillEmptyPlatformName(email, d.name);
  if (!resolved.ok) {
    console.error('[membership/public/join] person resolve failed', resolved.reason);
    return c.json({ error: 'could not create your contact record' }, 500);
  }
  const personId = resolved.personId;

  // Already an active member? Send them to sign-in instead of double-charging.
  const { data: existingMember } = await adminClient
    .from('membership_member')
    .select('id, status, locale')
    .eq('workspace_id', ws.id)
    .eq('person_id', personId)
    .maybeSingle();
  // Backfill-on-touch: a locale is only ever stamped onto a member row that
  // has none — an existing preference is never overwritten by a join visit.
  if (existingMember && joinLocale && existingMember.locale == null) {
    await adminClient
      .from('membership_member')
      .update({ locale: joinLocale, updated_at: new Date().toISOString() })
      .eq('id', existingMember.id);
  }
  if (existingMember && (existingMember.status === 'active' || existingMember.status === 'grace')) {
    return c.json({ already_member: true });
  }

  // Optional add-ons: only products the TIER offers as optional count; a
  // priced one becomes a one-time line item on the first invoice, a €0 one
  // rides along free. Amounts are the product's flat price — server-side,
  // like everything priced (the pricing logic stays a tier concept).
  const optionIds = [...new Set(d.option_product_ids)];
  let options: { id: string; name: string; price_cents: number | null; price_interval?: string | null }[] = [];
  if (optionIds.length) {
    const { data: links } = await adminClient
      .from('membership_tier_product')
      .select('product_id, product:product_id (id, name, price_cents, price_interval, archived_at, price_includes_vat)')
      .eq('tier_id', tier.id)
      .eq('optional', true)
      .in('product_id', optionIds);
    // THE BASKET (2026-10-16): beside the tier's optional add-ons, any
    // product this community sells on its own (purchasable, priced, not
    // archived) may ride the same checkout — one-off on the first invoice,
    // recurring as a line of the membership's subscription, exactly as an
    // option does below. Same lines, same VAT, same fee; no second rule.
    const { data: standalone } = await adminClient
      .from('membership_product')
      .select('id, name, price_cents, price_interval, archived_at, price_includes_vat')
      .eq('workspace_id', ws.id)
      .eq('purchasable', true)
      .is('archived_at', null)
      .gt('price_cents', 0)
      .in('id', optionIds);
    const byId = new Map(
      [
        ...(links ?? []).map((l) => (Array.isArray(l.product) ? l.product[0] : l.product)),
        ...(standalone ?? []),
      ]
        .filter((p): p is { id: string; name: string; price_cents: number | null; price_interval: string | null; archived_at: string | null; price_includes_vat: boolean } =>
          Boolean(p && !p.archived_at),
        )
        .map((p) => [p.id, p]),
    );
    const unknown = optionIds.filter((id) => !byId.has(id));
    if (unknown.length) {
      return c.json({ error: 'One of the chosen options is not available for this tier.' }, 400);
    }
    options = optionIds.map((id) => byId.get(id)!);
    // A product entered incl. VAT is charged at its NET (chargeNet), like the
    // tier: from here on every line below sees net prices.
    options = await Promise.all(
      options.map(async (o) => ({
        ...o,
        price_cents:
          o.price_cents == null
            ? o.price_cents
            : await chargeNet({ workspaceId: ws.id, enteredCents: o.price_cents, includesVat: (o as { price_includes_vat?: boolean }).price_includes_vat, country, vat_id: d.billing?.tax_no ?? null }),
      })),
    );
  }

  // A recurring product can only ride a subscription whose interval matches
  // (Stripe: one interval per subscription). 'once' always fits.
  const incompatible = options.find(
    (o) => (o.price_cents ?? 0) > 0 && (o.price_interval ?? 'once') !== 'once' && o.price_interval !== d.interval,
  );
  if (incompatible) {
    return c.json(
      { error: `'${incompatible.name}' is billed per ${incompatible.price_interval} and can only join a ${incompatible.price_interval}ly membership` },
      400,
    );
  }

  const feePercent = await platformFeePercent(ws.id);
  const base = `${MEMBERSHIP_APP_URL}/${encodeURIComponent(ws.slug)}`;

  // HAS THIS REQUESTER PROVEN THE ADDRESS THEY TYPED? This route is public
  // and the email is typed, so "an existing member joined again" and "a
  // stranger typed a member's address" look identical here — and the
  // difference decides whether we may touch that member's Stripe customer at
  // all. Same bar as the member-price endpoint: a session whose own verified
  // email is the one being joined. Nobody is asked to sign in; unproven
  // simply means a fresh customer.
  const provenEmail = (await participantEmailFromAuth(c))?.toLowerCase() ?? null;
  const proven = provenEmail !== null && provenEmail === email.toLowerCase();

  // WHO IS BEING BILLED, on the workspace's own account — created or reused
  // from our record of it, never found by searching Stripe. With it, the
  // invoicing details the panel collected are the ones Stripe puts on the
  // invoice, and `purchase.billing` keeps reading them off that invoice. It
  // can come back null (an account problem, a stale id), and then this falls
  // back to exactly what it did before: the email, and Stripe asking.
  const customer = await customerForJoin(stripe, account, {
    workspaceId: ws.id,
    personId,
    email,
    personName: d.name,
    billing: d.billing ?? null,
    proven,
  });

  // VAT ON TOP (Sjoerd, 2026-10-15: "Everything excl. VAT now"). The tier's
  // price is NET; a VAT-registered seller adds VAT by the one rule
  // (lib/sale-vat.ts) — the buyer's country, and reverse charge for an EU
  // business with a valid number abroad. The rate rides on every line as a
  // Stripe tax rate on the seller's own account, so Stripe's page and its
  // invoices show subtotal / VAT / total; renewals keep it.
  // The country the panel showed the VAT for (the page's picker) first, so
  // the charge matches what was shown; the invoice address otherwise.
  const buyerCountry = (country || d.billing?.country || '').toUpperCase() || null;
  const anythingPaid = amount > 0 || listAmount > 0 || options.some((o) => (o.price_cents ?? 0) > 0);
  if (anythingPaid && !buyerCountry && (await resolveSellerVat(ws.id))) {
    return c.json({ error: 'Choose your country, so the VAT can be worked out.', code: 'country_required' }, 400);
  }
  const vat: SaleVat = await saleVat({
    workspaceId: ws.id,
    net_cents: Math.max(amount, listAmount),
    country: buyerCountry,
    vat_id: d.billing?.tax_no ?? null,
  });
  const taxRateId = vat.rate_pct > 0 && vat.rate_country ? await connectedTaxRateId(account, vat.rate_country, vat.rate_pct) : null;
  const taxed = taxRateId ? { tax_rates: [taxRateId] } : {};

  // WHEN THE FULL-PRICE SUBSCRIPTION STARTS.
  //
  // Two different reasons produce the same shape — the first period paid as a
  // ONE-OFF line now, and the recurring line at full price starting later:
  //   • the launch cohort, whose first period ends on a fixed date;
  //   • a DISCOUNT CODE, which applies to the first period only, so the
  //     membership must renew at the undiscounted price.
  // Both are a trial that ends when the paid-for period does. Rehearsed on
  // test keys before any of it shipped (scripts/rehearse-discounted-join.mjs):
  // 150.00 now and 300.00 at the anniversary, and the two compose — a code on
  // a cohort tier pays 150.00 now and renews 300.00 on 1 January.
  const discounted = amount !== listAmount;
  const anniversary = (() => {
    const at = new Date();
    if (d.interval === 'year') at.setUTCFullYear(at.getUTCFullYear() + 1);
    else at.setUTCMonth(at.getUTCMonth() + 1);
    return Math.floor(at.getTime() / 1000);
  })();
  const startsBilling = fixedPeriod ? fixedPeriod.anchor : discounted ? anniversary : null;
  const split = startsBilling !== null;

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'subscription',
        line_items: [
          // WHAT IS PAID NOW. One-off when the subscription starts later —
          // leaving it recurring would bill the same period twice, once now
          // and once at the anchor. Omitted entirely at zero: a 100% code
          // charges nothing today, and Stripe refuses a zero-amount line.
          ...(amount > 0
            ? [
                {
                  price_data: {
                    currency: (tier.currency ?? 'EUR').toLowerCase(),
                    product_data: { name: `${ws.name} membership — ${tier.name}` },
                    unit_amount: amount,
                    ...(split ? {} : { recurring: { interval: d.interval } }),
                  },
                  quantity: 1,
                  ...taxed,
                },
              ]
            : []),
          // THE MEMBERSHIP ITSELF, at the FULL price, from `startsBilling`.
          // Present only when the first period was paid separately — an
          // ordinary undiscounted join's first line IS the subscription.
          ...(split
            ? [
                {
                  price_data: {
                    currency: (tier.currency ?? 'EUR').toLowerCase(),
                    product_data: { name: `${ws.name} membership — ${tier.name}` },
                    unit_amount: listAmount,
                    recurring: { interval: d.interval },
                  },
                  quantity: 1,
                  ...taxed,
                },
              ]
            : []),
          // ADD-ON LINES, SPLIT THE SAME WAY THE TIER IS.
          //
          // A 'once' extra bills now and never again. A recurring extra joins
          // the subscription — and THAT is where this was wrong until
          // 2026-10-14: every recurring line on a subscription with
          // `trial_end` is charged at the ANCHOR, so a cohort or discounted
          // join quietly moved the yearly extras to the renewal date while
          // the panel promised them today.
          //
          // Measured on test keys with Sjoerd's own production example — a
          // €300 cohort tier plus a €193.20 and a €2,000 yearly extra and a
          // €1,000 one-time one: Stripe collected 1,300.00 now and 2,493.20
          // on 1 January, against a panel that said 3,493.20 now. An
          // UNDERCHARGE, and a promise broken in both directions: too little
          // today, a surprise in January. Nobody had hit it — the one member
          // on a cohort tier joined before the rule existed and bought no
          // extras — because the date was only set on production that
          // morning.
          //
          // So when the subscription starts later, a recurring extra gets the
          // tier's treatment exactly: its first period as a one-off line now,
          // and a recurring line at full price from the anchor. A discount
          // code does not touch extras — it prices the tier, and an extra a
          // code does not name is not discounted.
          //
          // The two lines carry the same product name on purpose. They land
          // on DIFFERENT invoices — the one-off on today's, the recurring on
          // January's — so nobody sees one thing twice, and it is the same
          // treatment the tier's own two lines already have.
          ...options
            .filter((o) => (o.price_cents ?? 0) > 0)
            .flatMap((o) => {
              const currency = (tier.currency ?? 'EUR').toLowerCase();
              const once = {
                price_data: {
                  currency,
                  product_data: { name: o.name },
                  unit_amount: o.price_cents!,
                },
                quantity: 1,
                ...taxed,
              };
              const recurs = {
                price_data: {
                  currency,
                  product_data: { name: o.name },
                  unit_amount: o.price_cents!,
                  recurring: { interval: d.interval },
                },
                quantity: 1,
                ...taxed,
              };
              // Mixed intervals are refused further up, so an extra either
              // matches this join's interval or is a one-time thing.
              const recurring = (o.price_interval ?? 'once') === d.interval;
              if (!recurring) return [once];
              return split ? [once, recurs] : [recurs];
            }),
        ],
        subscription_data: {
          // ON THE NET PRICE. Stripe applies this percentage to the invoice
          // TOTAL, which includes the VAT added on top since 1.208.0 — and
          // the VAT is the seller's to pass on, not revenue to take a cut of.
          // Scaled by net/gross so the fee is feePercent of the net
          // (feeOnNetPercent); renewals keep the same rate, so it holds.
          ...(feePercent > 0 ? { application_fee_percent: feeOnNetPercent(feePercent, vat.rate_pct) } : {}),
          // The first renewal, and NOTHING extra charged for the stub period
          // between now and it. Without proration_behavior 'none' Stripe adds
          // a pro-rata charge on top of the one-off line above — the one word
          // that decides "exactly one charge now".
          // trial_end, NOT billing_cycle_anchor. Checkout refuses
          // `proration_behavior: 'none'` beside a one-time price outright
          // ("You cannot set proration_behavior to none in a Checkout Session
          // with one-time prices"), and without that word Stripe prorates the
          // stub period and adds it — 365.35 instead of 300.00, measured. A
          // trial has no proration to argue with: the one-off line is
          // collected now and the subscription's first charge is the trial
          // end. Rehearsed on a Stripe test clock: 300.00 on the day of the
          // join, 300.00 on 1 January, no proration on any line.
          ...(startsBilling ? { trial_end: startsBilling } : {}),
          metadata: {
            workspace_id: ws.id,
            person_id: personId,
            tier_id: tier.id,
            ...(country ? { country } : {}),
            ...(joinLocale ? { locale: joinLocale } : {}),
            // Only when ticked. A key that is absent reads as false at the
            // other end, which is the same answer the box gives by default —
            // and it keeps a metadata slot free for something that matters.
            ...(d.directory_listed ? { directory_listed: '1' } : {}),
            // WHICH TERMS they accepted, so the consent record can say so
            // when the membership begins. The version is the URL for a
            // workspace's own terms — we cannot know when somebody edits a
            // page we do not host, and "what was at this address on this
            // date" is the honest record.
            terms_version: joinTerms.version.slice(0, 480),
            applied_pct: String(pct),
            // WHICH CODE, so the ledger can answer "why was this 150 and not
            // 300" with something countable rather than a label, and so the
            // use is taken at payment confirmation rather than at checkout
            // creation — an abandoned checkout must not burn somebody's code.
            ...(discount && 'code' in discount
              ? { discount_code_id: discount.code.id, discount_code: discount.code.code }
              : {}),
            // Company and tax number, which a Stripe invoice cannot carry
            // back to us the way an address can. Merged into purchase.billing
            // in the webhook. Absent when the panel collected neither.
            ...billingMetadata(d.billing),
            // THE TICKED EXTRAS, on the SUBSCRIPTION and not only on the
            // session — because the welcome email is composed from
            // `sub.metadata`, and the purchase rows it would otherwise have
            // to read are written by a DIFFERENT event.
            //
            // `checkout.session.completed` writes those rows before it
            // converges the member, deliberately. But `invoice.paid` reaches
            // the same converge through memberForInvoice, and Stripe does not
            // promise an order between the two. Whichever lands first wins,
            // so the email could be composed before the rows exist — missing
            // the calendar for exactly the first member who bought one.
            ...(options.length ? { option_product_ids: options.map((o) => o.id).join(',') } : {}),
            // VAT ON TOP, for the ledger on every invoice of this
            // subscription (renewals included): which rule decided it.
            ...vatMetadata(vat),
          },
        },
        // The customer we just wrote, so the invoice carries OUR details —
        // and `customer_email` only when there is no customer, because Stripe
        // refuses a session that carries both.
        ...(customer.id ? { customer: customer.id } : { customer_email: email }),
        // 'auto' only when the customer actually HAS an address: asking a
        // second time for something we just collected is the double-typing
        // this change removes. Without one, 'required' — because with 'auto'
        // and no address on file Stripe may not ask at all for an ordinary
        // card, and then every invoice for somebody who typed nothing loses
        // its address block, which 'required' always captured (measured:
        // scripts/rehearse-join-customer.mjs, case 4).
        billing_address_collection: customer.hasAddress ? 'auto' : 'required',
        // A 100% code collects nothing today, and without this Stripe would
        // take no payment method — leaving the first renewal with nothing to
        // charge. Measured in the rehearsal, case 4.
        ...(amount === 0 ? { payment_method_collection: 'always' as const } : {}),
        // NO Stripe promotion codes (Sjoerd, 2026-10-13: "nothing of Stripe
        // is the rule, except payment"). Discounts, their rules and the
        // reason a price is what it is are OURS — Stripe is handed a final
        // amount and nothing else. A code typed on Stripe's page would be a
        // second discount system whose decisions never reach our ledger,
        // where "why was this 240 and not 300" has to be answerable.
        metadata: {
          workspace_id: ws.id,
          person_id: personId,
          tier_id: tier.id,
          request_id: d.request_id,
          ...(options.length ? { option_product_ids: options.map((o) => o.id).join(',') } : {}),
        },
        success_url: `${base}/joined?session_id={CHECKOUT_SESSION_ID}&lang=${resolvedLocale}`,
        // BACK MUST COME BACK TO THE SAME TIER. Without `tier`, pressing Back
        // on Stripe's page returns an invitee to the PUBLIC list — and for a
        // hidden tier that page does not contain the thing they were invited
        // to at all, so the cancel button quietly becomes a dead end.
        // Invitations point at exactly such links, so this is the common case
        // rather than an edge.
        cancel_url: `${base}?cancelled=1&lang=${resolvedLocale}&tier=${tier.id}`,
      },
      { stripeAccount: account },
    );
  } catch (e) {
    console.error('[membership/public/join] checkout create failed', e);
    return c.json({ error: 'could not start checkout' }, 502);
  }

  return c.json({ url: session.url });
});

// ---------------------------------------------------------------------------
// À-la-carte product buying (2026-09-06). The join flow's machinery — auto
// account, person create-or-match, Checkout on the workspace's connected
// account — but mode 'payment' (one-off), and a FLAT price: the pricing
// logic builder (§3.9) scopes to tiers and its attributes (country,
// interval) are subscription concepts, so products deliberately skip it.
// ---------------------------------------------------------------------------

const PublicBuy = z.object({
  workspace_slug: z.string().min(1).max(100),
  // One product (as since 2026-09-06), or several from the page's basket
  // (2026-10-16, additive): `product_ids` with two or more. Exactly one of
  // the two. A page sends `product_id` alone for a single product, so an
  // API one release behind still understands it.
  product_id: z.string().uuid().optional(),
  product_ids: z.array(z.string().uuid()).min(1).max(10).optional(),
  email: z.string().email(),
  name: z.string().min(1).max(200),
  locale: z.string().max(10).optional(),
  request_id: z.string().min(8).max(100),
  // VAT on top (2026-10-15): the buyer's country, and a business's VAT
  // number for reverse charge abroad. Required (country) only when the
  // community is VAT-registered.
  country: z.string().regex(/^[A-Za-z]{2}$/).optional(),
  vat_id: z.string().max(30).optional(),
});

membershipRoutes.post('/public/buy', async (c) => {
  const body = PublicBuy.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const d = body.data;
  const email = d.email.trim().toLowerCase();
  const wantIds = [...new Set(d.product_ids ?? (d.product_id ? [d.product_id] : []))];
  if (!wantIds.length || (d.product_id && d.product_ids)) {
    return c.json({ error: 'name one product (product_id) or several (product_ids)' }, 400);
  }

  const ws = await publicWorkspace(d.workspace_slug);
  if (!ws) return c.json({ error: 'not found' }, 404);

  const buyLocale = isLocale(d.locale) ? d.locale : null;
  const resolvedLocale = buyLocale ?? (await memberEmailLocale(ws.id, null));

  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);
  const account = await workspaceStripeAccount(ws.id);
  if (!account) {
    return c.json({ error: 'This community has not connected payments yet.' }, 503);
  }

  // Server-authoritative price: the product row IS the price. purchasable
  // is the product's own setting — a priced tier-only product stays unbuyable.
  // Every product named must be one this community sells on its own — one
  // that is not refuses the WHOLE basket, never quietly drops a line.
  const { data: rows } = await adminClient
    .from('membership_product')
    .select('id, name, price_cents, price_interval, currency, purchasable, price_includes_vat')
    .in('id', wantIds)
    .eq('workspace_id', ws.id)
    .is('archived_at', null);
  const found = wantIds.map((id) => (rows ?? []).find((r) => r.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  if (found.length !== wantIds.length) return c.json({ error: 'product not found' }, 404);
  // A product entered incl. VAT is charged at its NET (chargeNet) — every
  // line and the fee below see net prices, exactly as for an excl. product.
  const products = await Promise.all(
    found.map(async (p) => ({
      ...p,
      price_cents:
        p.price_cents == null
          ? p.price_cents
          : await chargeNet({ workspaceId: ws.id, enteredCents: p.price_cents, includesVat: p.price_includes_vat, country: d.country?.toUpperCase() ?? null, vat_id: d.vat_id ?? null }),
    })),
  );
  const unsellable = products.find((p) => !p.purchasable || p.price_cents == null || p.price_cents <= 0);
  if (unsellable) {
    return c.json({ error: products.length === 1 ? 'This product cannot be bought on its own.' : `${unsellable.name} cannot be bought on its own.` }, 400);
  }
  const product = products[0]!;
  const amount = products.reduce((sum, p) => sum + (p.price_cents ?? 0), 0);

  // Auto-account (the join-flow pattern): email-only, verify at sign-in.
  try {
    const { data: hasAccount } = await adminClient.rpc('auth_user_exists', { p_email: email });
    if (hasAccount !== true) {
      await adminClient.auth.admin.createUser({ email, email_confirm: true });
    }
  } catch (e) {
    console.warn('[membership/public/buy] account auto-create failed', e);
  }

  // Create-or-match the person via the platform SPoT. The old .ilike() match
  // here treated % and _ in the ADDRESS as wildcards — and _ is legal in an
  // address — so foo_bar@x.com could match fooXbar@x.com. email is citext, so
  // resolvePerson's .eq() is already case-insensitive and cannot wildcard.
  const resolved = await resolvePerson({
    workspaceId: ws.id,
    email,
    name: d.name,
    source: 'membership_purchase',
    create: true,
    fillEmptyName: true,
  });
  await fillEmptyPlatformName(email, d.name);
  if (!resolved.ok) {
    console.error('[membership/public/buy] person resolve failed', resolved.reason);
    return c.json({ error: 'could not create your contact record' }, 500);
  }
  const personId = resolved.personId;

  // Already owns it? Say so instead of double-charging (mirror of the join
  // flow's already_member).
  const { data: owned } = await adminClient
    .from('membership_product_purchase')
    .select('product_id')
    .eq('workspace_id', ws.id)
    .eq('person_id', personId)
    .in('product_id', wantIds)
    .eq('status', 'paid');
  if ((owned ?? []).length) {
    // Which ones (additive): a basket can say which line is already theirs.
    return c.json({ already_purchased: true, product_ids: [...new Set((owned ?? []).map((o) => o.product_id as string))] });
  }

  // One-off payment mode allows the FIXED fee amount — same plan-aware
  // percent as the join flow, applied to this charge.
  const feePercent = await platformFeePercent(ws.id);
  const applicationFeeCents = Math.round((amount * feePercent) / 100);

  // VAT ON TOP — the same rule and Stripe tax rate as the join.
  const buyCountry = d.country?.toUpperCase() ?? null;
  if (!buyCountry && (await resolveSellerVat(ws.id))) {
    return c.json({ error: 'Choose your country, so the VAT can be worked out.', code: 'country_required' }, 400);
  }
  const buyVat = await saleVat({ workspaceId: ws.id, net_cents: amount, country: buyCountry, vat_id: d.vat_id ?? null });
  const buyTaxRate = buyVat.rate_pct > 0 && buyVat.rate_country ? await connectedTaxRateId(account, buyVat.rate_country, buyVat.rate_pct) : null;

  const base = `${MEMBERSHIP_APP_URL}/${encodeURIComponent(ws.slug)}`;
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        // One line per product, each with the VAT rule's rate.
        line_items: products.map((p) => ({
          price_data: {
            currency: (p.currency ?? 'EUR').toLowerCase(),
            product_data: { name: `${ws.name} — ${p.name}` },
            unit_amount: p.price_cents!,
          },
          quantity: 1,
          ...(buyTaxRate ? { tax_rates: [buyTaxRate] } : {}),
        })),
        payment_intent_data: {
          ...(applicationFeeCents > 0 ? { application_fee_amount: applicationFeeCents } : {}),
          metadata: { workspace_id: ws.id, person_id: personId, membership_product_id: product.id },
        },
        customer_email: email,
        billing_address_collection: 'required',
        // Same rule as the join above: Stripe is the rail, not the pricing
        // authority.
        // membership_product_id + person_id is the webhook discriminator —
        // distinct from membership_purchase_id (manual-invoice pay links)
        // and from the subscription join flow's tier_id.
        metadata: {
          workspace_id: ws.id,
          person_id: personId,
          membership_product_id: product.id,
          // The whole basket, when there is more than one (the first stays in
          // membership_product_id, which an older webhook reads).
          ...(products.length > 1 ? { membership_product_ids: products.map((p) => p.id).join(',') } : {}),
          request_id: d.request_id,
          ...vatMetadata(buyVat),
        },
        success_url: `${base}/purchased?session_id={CHECKOUT_SESSION_ID}&lang=${resolvedLocale}`,
        cancel_url: `${base}?cancelled=1&lang=${resolvedLocale}`,
      },
      // request_id doubles as the Stripe idempotency key: a double-submit
      // from the same page visit returns the SAME session, never two.
      { stripeAccount: account, idempotencyKey: `membuy_${d.request_id}` },
    );
  } catch (e) {
    console.error('[membership/public/buy] checkout create failed', e);
    return c.json({ error: 'could not start checkout' }, 502);
  }

  return c.json({ url: session.url });
});

// ===========================================================================
// Stripe webhook (Connect events from workspaces' accounts).
// Own secret, NO fallback — the billing.ts rule: a webhook verifying
// against the wrong endpoint's secret is an outage dressed as security.
// ===========================================================================

// Both checkout.session.completed and the FIRST invoice.paid can create the
// member (webhook ordering is not guaranteed) — they converge here.
/** The join form's directory answer, applied when membership actually begins.
 *
 *  Only ever turns listing ON: the box is a consent given at the door, and a
 *  visitor who left it unticked has said nothing about an entry they may
 *  already have from the portal. Turning listing off is the member's own act,
 *  in their own portal.
 *
 *  Never fatal to the webhook — a membership that exists is worth more than a
 *  directory row, and the member can set it themselves. It is logged.
 */
/** The terms acceptance, recorded where membership begins — the same place
 *  and the same reason as the directory consent: a visitor who never pays has
 *  agreed to nothing that matters, and a record of an agreement nobody acted
 *  on is noise in an evidence table.
 *
 *  Never fatal to the webhook: a membership that exists is worth more than a
 *  consent row, and the row can be reconstructed from the Stripe metadata if
 *  it ever has to be. It is logged. */
async function recordTermsAcceptance(meta: Record<string, string>): Promise<void> {
  if (!meta.terms_version || !meta.person_id) return;
  const { error } = await adminClient.from('consent_record').insert({
    person_id: meta.person_id,
    purpose_code: 'terms_of_service',
    legal_basis: 'contract',
    text_version: meta.terms_version,
  });
  // 23505: the other webhook recorded it first, which is success.
  if (error && error.code !== '23505') {
    console.error('[membership webhook] terms acceptance not recorded', meta.person_id, error.message);
  }
}

async function recordJoinDirectoryChoice(
  meta: Record<string, string>,
  memberId: string,
): Promise<void> {
  if (meta.directory_listed !== '1') return;
  const saved = await setDirectoryListing({
    workspaceId: meta.workspace_id!,
    personIds: [meta.person_id!],
    listed: true,
  });
  if (!saved.ok) {
    console.error('[membership webhook] directory consent not recorded', memberId, saved.step, saved.message);
  }
}

async function ensureMemberFromSubscription(
  account: string,
  subscriptionId: string,
): Promise<{ id: string; workspace_id: string; person_id: string; tier_id: string; status: string; locale: string | null } | null> {
  const { data: existing } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, status, locale')
    .eq('stripe_subscription_id', subscriptionId)
    .maybeSingle();
  if (existing) return existing;

  const stripe = stripeOrNull();
  if (!stripe) return null;
  const sub = await stripe.subscriptions.retrieve(subscriptionId, {}, { stripeAccount: account });
  const meta = sub.metadata ?? {};
  if (!meta.workspace_id || !meta.person_id || !meta.tier_id) {
    console.error('[membership webhook] subscription without membership metadata', subscriptionId);
    return null;
  }

  const periodEnd = sub.items.data[0]?.current_period_end ?? null;
  const renewsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null;

  // The join page's language rides the subscription metadata (like country).
  const metaLocale = isLocale(meta.locale) ? meta.locale : null;

  // Rejoin reuses the (workspace, person) row — history survives the lapse.
  const { data: prior } = await adminClient
    .from('membership_member')
    .select('id, status, locale')
    .eq('workspace_id', meta.workspace_id)
    .eq('person_id', meta.person_id)
    .maybeSingle();

  if (prior) {
    await adminClient
      .from('membership_member')
      .update({
        tier_id: meta.tier_id,
        status: 'active',
        renews_at: renewsAt,
        lapsed_at: null,
        deleted_at: null,
        // A lapsed/removed SEAT holder joining on their own card takes the
        // row over as a personal membership — detach it from the org so
        // org-driven propagation stops steering their tier/status.
        org_member_id: null,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: customer,
        ...(meta.country ? { country: meta.country } : {}),
        // Backfill-on-touch only — an existing locale is never overwritten.
        ...(metaLocale && prior.locale == null ? { locale: metaLocale } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq('id', prior.id);
    await recordJoinDirectoryChoice(meta, prior.id);
    await recordTermsAcceptance(meta);
    const rejoining = prior.status === 'lapsed' || prior.status === 'cancelled';
    await logMemberActivity(
      meta.workspace_id,
      meta.person_id,
      rejoining ? 'membership_rejoined' : 'membership_joined',
      rejoining ? 'Rejoined' : 'Joined',
    );
    await reconcileMemberAccess(prior.id);
    return { id: prior.id, workspace_id: meta.workspace_id, person_id: meta.person_id, tier_id: meta.tier_id, status: 'active', locale: prior.locale ?? metaLocale };
  }

  const { data: created, error } = await adminClient
    .from('membership_member')
    .insert({
      workspace_id: meta.workspace_id,
      person_id: meta.person_id,
      tier_id: meta.tier_id,
      status: 'active',
      renews_at: renewsAt,
      stripe_subscription_id: subscriptionId,
      stripe_customer_id: customer,
      ...(meta.country ? { country: meta.country } : {}),
      ...(metaLocale ? { locale: metaLocale } : {}),
    })
    .select('id, workspace_id, person_id, tier_id, status, locale')
    .single();
  if (created) await recordJoinDirectoryChoice(meta, created.id as string);
  if (created) await recordTermsAcceptance(meta);
  if (error) {
    // 23505 = a concurrent webhook created it — read it back.
    if (error.code === '23505') {
      const { data: raced } = await adminClient
        .from('membership_member')
        .select('id, workspace_id, person_id, tier_id, status, locale')
        .eq('workspace_id', meta.workspace_id)
        .eq('person_id', meta.person_id)
        .maybeSingle();
      return raced ?? null;
    }
    console.error('[membership webhook] member insert failed', error);
    return null;
  }

  // `description` and `characteristics` are the community's OWN words about
  // this tier — the paragraph and the ticks on the join card. The welcome
  // email shows them in preference to anything we could write, because they
  // know what they are offering and we do not.
  const { data: tier } = await adminClient
    .from('membership_tier')
    .select('name, description, characteristics')
    .eq('id', meta.tier_id)
    .maybeSingle();
  await logMemberActivity(meta.workspace_id, meta.person_id, 'membership_joined', `Joined · ${tier?.name ?? 'membership'}`);
  await reconcileMemberAccess(created.id);

  // Welcome email, workspace-branded.
  try {
    const [{ data: person }, { data: ws }, brand] = await Promise.all([
      adminClient.from('person').select('first_name, email').eq('id', meta.person_id).maybeSingle(),
      adminClient.from('workspace').select('name, slug').eq('id', meta.workspace_id).maybeSingle(),
      getWorkspaceBrand(meta.workspace_id),
    ]);

    // THE TEAM CALENDARS, named only when the membership really opens one.
    // The email says "your membership includes {team}'s calendar", and a
    // sentence like that must not be printed on a hope: the grants are what
    // decide, so they are read rather than assumed. One line of the old email
    // said invitations would "arrive from each space", which was true of no
    // membership in particular — this replaces that with something specific
    // or with nothing.
    //
    // THIS USED TO READ GRANTS KEYED ON THE TIER ALONE, and therefore printed
    // nothing on soul.com — where every team_calendar grant hangs off a
    // PRODUCT, not a tier (checked on production 2026-10-14: five such grants,
    // none tier-keyed). `teamCalendarNamesFor` is the resolver the member price
    // already uses, so the email now names exactly the calendars the member
    // will actually be given a member price on. A second, narrower copy of
    // "what does this tier include" is how the two disagreed in the first
    // place.
    //
    // The person goes with the tier, so a calendar that came from an optional
    // extra they BOUGHT is named too — the tier includes some products and
    // merely offers others, and a paid-for calendar missing from the welcome
    // is the same omission in a smaller place.
    const calendarTeamNames = await teamCalendarNamesFor(meta.tier_id, {
      personId: meta.person_id,
      workspaceId: meta.workspace_id,
      // THE UNION, and it has to be a union. The metadata says what was
      // bought in THIS join, and is readable before the purchase rows exist;
      // the table says what was bought in an earlier one, which the metadata
      // of this subscription knows nothing about. Either source alone drops
      // a calendar somebody paid for.
      alsoBought: (meta.option_product_ids ?? '').split(',').filter(Boolean),
    });

    if (person?.email) {
      const welcomeLocale = await memberEmailLocale(meta.workspace_id, created.locale);
      const welcomePortal = ws?.slug ? `${stackSurfaceUrl('my-portal', process.env)}/memberships` : null;
      const msg = membershipWelcome({
        name: person.first_name ?? 'there',
        communityName: ws?.name ?? 'the community',
        tierName: tier?.name ?? 'membership',
        renewsAt,
        tierDescription: tier?.description ?? null,
        characteristics: (tier?.characteristics as string[] | null) ?? null,
        calendarTeamNames,
        // THIS community's page in the portal, on THIS stack. `surfaceUrl`
        // reads the environment, which is the only thing that knows whether
        // this API is the .app or the .tech one — a hand-built URL here is
        // how a staging email has sent somebody to production before.
        portalUrl: ws?.slug
          ? `${stackSurfaceUrl('my-portal', process.env)}/memberships`
          : null,
        email: person.email,
        locale: welcomeLocale,
        brand: { logoUrl: brand.logoUrl, name: brand.fromName },
        custom: await communityWords({
          workspaceId: meta.workspace_id,
          kind: 'welcome',
          tierId: meta.tier_id,
          memberLocale: welcomeLocale,
          values: memberEmailValues({ firstName: person.first_name, communityName: ws?.name, tierName: tier?.name, renewsAt, portalUrl: welcomePortal, locale: welcomeLocale }),
        }),
      });
      await sendEmail({
        to: person.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...senderOf(brand),
      });
    }
  } catch (e) {
    console.warn('[membership webhook] welcome email failed', e);
  }

  return created;
}


// Subscription id off an invoice — the field moved across Stripe API
// versions (top-level → parent.subscription_details), so read defensively.
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const inv = invoice as unknown as {
    subscription?: string | { id?: string } | null;
    parent?: { subscription_details?: { subscription?: string | { id?: string } | null } | null } | null;
  };
  const raw = inv.subscription ?? inv.parent?.subscription_details?.subscription ?? null;
  if (!raw) return null;
  return typeof raw === 'string' ? raw : raw.id ?? null;
}

/** The subscription's metadata as the invoice carries it. Same defensive
 *  read as `invoiceSubscriptionId` and for the same reason: the field moved
 *  from the top level into `parent.subscription_details` across API versions,
 *  and this is read on a webhook we cannot re-run. Nothing found is `{}` —
 *  the billing extras are additive, and an invoice without them is simply an
 *  invoice from before the panel asked.
 *
 *  Read off the INVOICE rather than fetched: a round trip to Stripe for two
 *  short strings, on every membership invoice, to learn something the invoice
 *  is already carrying. */
function invoiceSubscriptionMetadata(invoice: Stripe.Invoice): Record<string, string> {
  const inv = invoice as unknown as {
    subscription_details?: { metadata?: Record<string, string> | null } | null;
    parent?: { subscription_details?: { metadata?: Record<string, string> | null } | null } | null;
  };
  return inv.subscription_details?.metadata ?? inv.parent?.subscription_details?.metadata ?? {};
}

async function memberForInvoice(
  account: string,
  invoice: Stripe.Invoice,
): Promise<{ id: string; workspace_id: string; person_id: string; tier_id: string; status: string; locale: string | null } | null> {
  const subId = invoiceSubscriptionId(invoice);
  if (subId) {
    const member = await ensureMemberFromSubscription(account, subId);
    if (member) return member;
  }
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return null;
  const { data } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, status, locale')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data;
}

async function warnOnCardCountryMismatch(
  account: string,
  invoice: Stripe.Invoice,
  member: { id: string; workspace_id: string; person_id: string },
): Promise<void> {
  const { data: m } = await adminClient
    .from('membership_member')
    .select('country')
    .eq('id', member.id)
    .maybeSingle();
  const declared = m?.country?.toUpperCase();
  if (!declared) return;

  const stripe = stripeOrNull();
  if (!stripe) return;
  const chargeId = (invoice as unknown as { charge?: string | { id?: string } | null }).charge;
  const chargeRef = typeof chargeId === 'string' ? chargeId : chargeId?.id;
  if (!chargeRef) return;
  const charge = await stripe.charges.retrieve(chargeRef, {}, { stripeAccount: account });
  const cardCountry = charge.payment_method_details?.card?.country?.toUpperCase();
  if (!cardCountry || cardCountry === declared) return;

  // One warning per invoice.
  const { error: dedupErr } = await adminClient
    .from('membership_reminder_send')
    .insert({ member_id: member.id, reminder_kind: 'card_country_mismatch', period_ref: invoice.id ?? 'unknown' });
  if (dedupErr) return; // 23505 = already warned

  const [{ data: person }, { data: admins }, brand] = await Promise.all([
    adminClient.from('person').select('first_name, last_name, email').eq('id', member.person_id).maybeSingle(),
    adminClient
      .from('workspace_member')
      .select('user:user_id (email)')
      .eq('workspace_id', member.workspace_id)
      .in('workspace_role', ['admin', 'super_admin']),
    getWorkspaceBrand(member.workspace_id),
  ]);
  const name = [person?.first_name, person?.last_name].filter(Boolean).join(' ') || person?.email || 'A member';
  for (const row of admins ?? []) {
    const u = Array.isArray(row.user) ? row.user[0] : row.user;
    if (!u?.email) continue;
    await sendEmail({
      to: u.email,
      subject: `Pricing check: ${name} declared ${declared}, paid with a ${cardCountry} card`,
      text: `${name} joined with country ${declared} (which sets their membership price) but paid with a card issued in ${cardCountry}.

Nothing was blocked — this is a heads-up so you can review the membership if it looks off. You can change their country on the member (it reprices from the next renewal).`,
      html: '',
      ...senderOf(brand),
    });
  }
}

/** A Stripe application_fee_percent that takes `pct` of the NET when the
 *  invoice total carries `vatPct` on top (Stripe allows two decimals). */
export function feeOnNetPercent(pct: number, vatPct: number): number {
  return Math.round(((pct * 100) / (100 + Math.max(0, vatPct))) * 100) / 100;
}

/** The VAT decision, as subscription metadata (strings, few keys). */
export function vatMetadata(vat: SaleVat): Record<string, string> {
  return {
    vat_rule: 'excl',
    vat_rate_pct: String(vat.rate_pct),
    ...(vat.label ? { vat_label: vat.label } : {}),
  };
}

/** What Stripe invoiced, as the ledger's breakdown — for invoices of a
 *  subscription that carries vat_rule=excl. Empty otherwise. */
export function vatBreakdownFromInvoice(
  invoice: Pick<Stripe.Invoice, 'subtotal' | 'subtotal_excluding_tax' | 'total_taxes' | 'amount_paid'>,
  meta: Record<string, string>,
): Record<string, unknown> {
  if (meta.vat_rule !== 'excl') return {};
  const tax = (invoice.total_taxes ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const net = invoice.subtotal_excluding_tax ?? invoice.subtotal ?? Math.max(0, (invoice.amount_paid ?? 0) - tax);
  return {
    subtotal_cents: net,
    tax_cents: tax,
    tax_label: meta.vat_label ?? null,
  };
}

async function membershipInvoicePaid(account: string, invoice: Stripe.Invoice): Promise<void> {
  const member = await memberForInvoice(account, invoice);
  if (!member) {
    // A connected account's invoice that isn't a membership (workspaces use
    // Stripe for their own things too) — not ours, not an error.
    return;
  }

  const [{ data: tier }, { data: person }, { data: ws }] = await Promise.all([
    adminClient.from('membership_tier').select('name').eq('id', member.tier_id).maybeSingle(),
    adminClient.from('person').select('first_name, last_name, email').eq('id', member.person_id).maybeSingle(),
    adminClient.from('workspace').select('name').eq('id', member.workspace_id).maybeSingle(),
  ]);

  // A ONE-OFF ADD-ON bought in my.thread → Purchases (lib/membership-change.ts)
  // is an invoice of its own on the member's customer, so it resolves to the
  // member here too. It names itself (`item_label`) and says nothing about the
  // membership's period: no renews_at from its line, no "membership —" label.
  const addonLabel = invoice.metadata?.membership_addon ? (invoice.metadata.item_label ?? null) : null;
  const periodEnd = addonLabel ? undefined : invoice.lines?.data?.[0]?.period?.end;
  const renewsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null;
  const isRenewal = invoice.billing_reason === 'subscription_cycle';
  // A tier change or a recurring add-on is invoiced as 'subscription_update'
  // (the proration). A downgrade's is zero or negative — a credit carried to
  // the next invoice, not money paid — and leaves no ledger row.
  const isChange = invoice.billing_reason === 'subscription_update';
  if (isChange && (invoice.amount_paid ?? 0) <= 0) return;

  if (!addonLabel) {
    const patch: Record<string, unknown> = { status: 'active', updated_at: new Date().toISOString() };
    if (renewsAt) patch.renews_at = renewsAt;
    await adminClient.from('membership_member').update(patch).eq('id', member.id);
  }
  if (isRenewal) {
    await logMemberActivity(member.workspace_id, member.person_id, 'membership_renewed', `Renewed · ${tier?.name ?? ''}`);
    await reconcileMemberAccess(member.id);
  }

  // The ledger row — one per billing period, keyed by the Stripe invoice.
  // Seller VAT (inclusive split) is stamped by recordPurchase itself.
  const addr = invoice.customer_address;
  const subMeta = invoiceSubscriptionMetadata(invoice);
  // THE LAST DAY, not the renewal moment. Stripe's `period.end` is the
  // instant the next period begins, so naming it directly made this label say
  // "(until 2027-01-01)" for a membership the join panel had just promised
  // "runs to 31 December 2026". Both describe one period; both on one
  // purchase is what makes it a problem. An ordinary yearly join has the same
  // day-off, so the rule is one helper used everywhere a member is shown a
  // period (@thefibre/shared/membership-period).
  //
  // Rows written before 2026-10-13 keep the label they have: a receipt
  // already sent is a document, and documents are not rewritten.
  const lastDay = periodLastDay(periodEnd ?? null);
  const label =
    addonLabel ??
    `${ws?.name ?? 'Community'} membership — ${tier?.name ?? ''}${isChange ? ' · change' : ''}${
      lastDay ? ` (until ${lastDay})` : ''
    }`;
  const itemRef = invoice.id ?? `membership-invoice-${member.id}-${Date.now()}`;
  await recordPurchase({
    appSlug: 'membership',
    workspaceId: member.workspace_id,
    itemRef,
    personId: member.person_id,
    itemLabel: label,
    payerName:
      invoice.customer_name ?? [person?.first_name, person?.last_name].filter(Boolean).join(' '),
    payerEmail: invoice.customer_email ?? person?.email ?? null,
    amountCents: invoice.amount_paid ?? 0,
    currency: (invoice.currency ?? 'eur').toUpperCase(),
    method: 'stripe',
    status: 'paid',
    // WHY THIS COST WHAT IT DID. 'coupon' is the same word the thread path
    // writes, so /admin/economics can count both together. Null means full
    // price, which is what every row without a code says.
    ...(subMeta.discount_code_id ? { discountReason: 'coupon' as const } : {}),
    stripeInvoiceId: invoice.id ?? null,
    stripeInvoiceUrl: invoice.hosted_invoice_url ?? null,
    stripeAccountId: account,
    billing: {
      number: invoice.number ?? null,
      company: invoice.customer_name ?? null,
      address: addr?.line1 ?? null,
      postal_code: addr?.postal_code ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
      period_end: renewsAt,
      pdf: invoice.invoice_pdf ?? null,
      // The two fields a Stripe invoice cannot carry back. The address makes
      // the round trip through the customer the join wrote; a tax number does
      // not (Stripe keeps those as TaxID objects with a type we would have to
      // guess), and "who pays" is our question, not Stripe's. Spread last and
      // only when present, so nothing above is overwritten with a blank.
      ...readBillingMetadata(subMeta),
      // VAT ON TOP (2026-10-15): the net / VAT / gross Stripe actually
      // invoiced, so our invoice says what was charged. Only for
      // subscriptions started under the excl. rule (they carry vat_rule);
      // older ones keep the inclusive split recordPurchase stamps.
      ...vatBreakdownFromInvoice(invoice, addonLabel ? { vat_rule: 'excl' } : subMeta),
      // Line by line, when there is more than one thing on the invoice.
      ...((invoice.lines?.data?.length ?? 0) > 1 ? { lines: invoiceLines(invoice) } : {}),
    },
  });

  // TAKE THE USE — at payment confirmation, on the join's OWN invoice, once.
  //
  // Not at checkout creation, which would burn a use on every abandoned
  // checkout. And `=== 'subscription_create'`, not "anything but a renewal":
  // the negative form also fired on 'subscription_update' (a tier change, a
  // proration invoice), on 'manual', and on whatever Stripe adds next, so a
  // member who moved tier would quietly spend another use of the code they
  // joined with.
  //
  // ONCE PER INVOICE, because `invoice.paid` can be delivered more than once
  // and each delivery would otherwise take another use. The ledger row
  // survives a retry on its own (recordPurchase is update-first on item_ref);
  // the redemption is a counter and cannot. The insert IS the guard: a
  // duplicate raises 23505 and the use is simply not taken again.
  //
  // `membership_reminder_send` is doing the work despite its name — it is
  // this codebase's per-invoice "we already did this" ledger, and the
  // card-country warning above uses it the same way. A redemption record
  // proper (which code, which member, which invoice) would be better and is
  // worth a table of its own when somebody wants to read it back; inventing
  // one here for a boolean is not.
  if (subMeta.discount_code_id && invoice.billing_reason === 'subscription_create') {
    const { error: dedup } = await adminClient.from('membership_reminder_send').insert({
      member_id: member.id,
      reminder_kind: 'discount_code_redeemed',
      period_ref: invoice.id ?? 'unknown',
    });
    // ONLY 23505 MEANS "already". Any error reading as "already done" is the
    // wrong way to fail: a network blip or a schema-cache miss would skip the
    // redeem silently and under-count the code, which nobody would ever
    // notice — the community simply gets fewer redemptions than it sold.
    // Anything else is logged and the redeem GOES AHEAD, because the atomic
    // RPC is the real limit; the dedup only exists to stop a retry, and
    // failing it open costs at most one extra use against a code that still
    // cannot exceed its own ceiling.
    const alreadyRedeemed = dedup?.code === '23505';
    if (dedup && !alreadyRedeemed) {
      console.error(
        '[membership/webhook] redeem dedup insert failed; redeeming anyway',
        dedup.code,
        dedup.message,
      );
    }
    if (!alreadyRedeemed) {
      // A refusal from the RPC is logged and nothing more: it means the last
      // use went to somebody else in the seconds in between, and this join is
      // already paid. Refusing it now would be worse than honouring one more
      // use of a code.
      const took = await redeemDiscountCode(subMeta.discount_code_id);
      if (!took) {
        console.warn(
          '[membership/webhook] discount code could not be redeemed (already paid, honoured anyway)',
          subMeta.discount_code_id,
          member.id,
        );
      }
    }
  }

  // Card-country vs declared-country (§3.9 D3): mismatch WARNS the
  // workspace admins, never blocks. Once per invoice (dedup table).
  try {
    await warnOnCardCountryMismatch(account, invoice, member);
  } catch (e) {
    console.warn('[membership/webhook] card-country check failed', e);
  }

  // Receipt in the house style, the WORKSPACE as seller (no override —
  // sendReceipt reads `app_id` off the row and sellerForSale pins a
  // membership sale to the community's own invoice details).
  const { data: saved } = await adminClient
    .from('purchase')
    .select('payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, billing, stripe_invoice_url, organiser_user_id, app_id')
    .eq('stripe_invoice_id', invoice.id ?? '')
    .maybeSingle();
  if (saved) {
    void sendReceipt(member.workspace_id, saved as Record<string, unknown>).catch((e) =>
      console.error('[membership/webhook] receipt email failed', e),
    );
  }
}

async function membershipInvoiceFailed(account: string, invoice: Stripe.Invoice): Promise<void> {
  const member = await memberForInvoice(account, invoice);
  if (!member) return;
  if (member.status === 'active') {
    await adminClient
      .from('membership_member')
      .update({ status: 'grace', updated_at: new Date().toISOString() })
      .eq('id', member.id);
    await logMemberActivity(member.workspace_id, member.person_id, 'membership_payment_failed', 'Payment failed — grace period');
  }

  // One email per failed invoice (dedup on the invoice id).
  const { error: dedupErr } = await adminClient
    .from('membership_reminder_send')
    .insert({ member_id: member.id, reminder_kind: 'payment_failed', period_ref: invoice.id ?? 'unknown' });
  if (dedupErr) {
    if (dedupErr.code !== '23505') console.warn('[membership/webhook] dedup insert failed', dedupErr);
    return;
  }
  const [{ data: person }, { data: ws }, { data: tier }, brand] = await Promise.all([
    adminClient.from('person').select('first_name, email').eq('id', member.person_id).maybeSingle(),
    adminClient.from('workspace').select('name').eq('id', member.workspace_id).maybeSingle(),
    adminClient.from('membership_tier').select('name').eq('id', member.tier_id).maybeSingle(),
    getWorkspaceBrand(member.workspace_id),
  ]);
  if (person?.email) {
    const msg = membershipPaymentFailed({
      name: person.first_name ?? 'there',
      communityName: ws?.name ?? 'the community',
      tierName: tier?.name ?? 'membership',
      locale: await memberEmailLocale(member.workspace_id, member.locale),
      brand: { logoUrl: brand.logoUrl, name: brand.fromName },
    });
    await sendEmail({
      to: person.email,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      ...senderOf(brand),
    });
  }
}

async function membershipSubscriptionDeleted(account: string, sub: Stripe.Subscription): Promise<void> {
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, status, locale')
    .eq('stripe_subscription_id', sub.id)
    .maybeSingle();
  if (!member || member.status === 'lapsed' || member.status === 'cancelled') return;

  await adminClient
    .from('membership_member')
    .update({ status: 'lapsed', lapsed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', member.id);
  await logMemberActivity(member.workspace_id, member.person_id, 'membership_lapsed', 'Membership lapsed');
  await reconcileMemberAccess(member.id);

  try {
    const [{ data: person }, { data: ws }, brand] = await Promise.all([
      adminClient.from('person').select('first_name, email').eq('id', member.person_id).maybeSingle(),
      adminClient.from('workspace').select('name, slug').eq('id', member.workspace_id).maybeSingle(),
      getWorkspaceBrand(member.workspace_id),
    ]);
    if (person?.email) {
      const msg = membershipLapsed({
        name: person.first_name ?? 'there',
        communityName: ws?.name ?? 'the community',
        joinUrl: ws?.slug ? `${MEMBERSHIP_APP_URL}/${encodeURIComponent(ws.slug)}` : null,
        locale: await memberEmailLocale(member.workspace_id, member.locale),
        brand: { logoUrl: brand.logoUrl, name: brand.fromName },
      });
      await sendEmail({
        to: person.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...senderOf(brand),
      });
    }
  } catch (e) {
    console.warn('[membership/webhook] lapsed email failed', e);
  }
}

// À-la-carte completion: record the purchase (app fact + platform ledger),
// grant the product's access, mail the receipt. Idempotency anchor: the
// membership_product_purchase unique stripe_session_id — a webhook retry
// hits 23505 and returns before any second email.
async function membershipProductPurchased(
  account: string,
  session: Stripe.Checkout.Session,
): Promise<void> {
  const meta = session.metadata ?? {};
  const productId = meta.membership_product_id;
  const personId = meta.person_id;
  const workspaceId = meta.workspace_id;
  if (!productId || !personId || !workspaceId) {
    console.error('[membership/webhook] product purchase without metadata', session.id);
    return;
  }

  // The page's basket can buy several in one session (2026-10-16).
  const ids = (meta.membership_product_ids ?? productId).split(',').filter(Boolean);
  const { data: found } = await adminClient
    .from('membership_product')
    .select('id, name, links, price_cents, currency')
    .in('id', ids)
    .eq('workspace_id', workspaceId);
  const products = ids.map((id) => (found ?? []).find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p);
  const product = products[0];
  if (!product) {
    console.error('[membership/webhook] purchased product not found', productId);
    return;
  }

  const amount = session.amount_total ?? products.reduce((sum, p) => sum + (p.price_cents ?? 0), 0);
  const currency = (session.currency ?? product.currency ?? 'eur').toUpperCase();

  // One grant row per product, keyed (session, product): a retry is 23505.
  let firstTime = false;
  for (const p of products) {
    const { error: insertErr } = await adminClient.from('membership_product_purchase').insert({
      workspace_id: workspaceId,
      person_id: personId,
      product_id: p.id,
      stripe_session_id: session.id,
      // A single product keeps the session's total (as before); in a basket
      // each row carries its own net price.
      amount_cents: products.length === 1 ? amount : (p.price_cents ?? 0),
      currency,
      status: 'paid',
    });
    if (!insertErr) firstTime = true;
    else if (insertErr.code !== '23505') console.error('[membership/webhook] product purchase insert failed', insertErr);
  }
  if (!firstTime) return; // webhook retry — already done

  const [{ data: person }, { data: ws }] = await Promise.all([
    adminClient.from('person').select('first_name, last_name, email').eq('id', personId).maybeSingle(),
    adminClient.from('workspace').select('name').eq('id', workspaceId).maybeSingle(),
  ]);

  // The ledger row (Stripe is rails, the ledger is the record). Keyed on the
  // session id — recordPurchase's update-first-insert-second keeps retries
  // safe even if the row above ever loosens.
  const itemRef = `product-${session.id}`;
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
  const addr = session.customer_details?.address;
  await recordPurchase({
    appSlug: 'membership',
    workspaceId,
    itemRef,
    personId,
    payerName:
      session.customer_details?.name ??
      [person?.first_name, person?.last_name].filter(Boolean).join(' '),
    payerEmail: session.customer_details?.email ?? person?.email ?? null,
    itemLabel: `${ws?.name ?? 'Community'} — ${products.map((p) => p.name).join(', ')}`,
    amountCents: amount,
    currency,
    method: 'stripe',
    status: 'paid',
    stripePaymentIntent: paymentIntent,
    stripeAccountId: account,
    billing: {
      // VAT on top: what Stripe actually charged, split (sessions started
      // under the excl. rule carry vat_rule).
      ...(meta.vat_rule === 'excl'
        ? {
            subtotal_cents: session.amount_subtotal ?? amount,
            tax_cents: session.total_details?.amount_tax ?? 0,
            tax_label: meta.vat_label ?? null,
          }
        : {}),
      address: addr?.line1 ?? null,
      postal_code: addr?.postal_code ?? null,
      city: addr?.city ?? null,
      country: addr?.country ?? null,
      // A basket: one ledger row for the session, its lines inside.
      ...(products.length > 1
        ? {
            lines: products.map((p) => ({
              label: p.name,
              net_cents: p.price_cents ?? 0,
              vat_cents: Math.round(((p.price_cents ?? 0) * Number(meta.vat_rate_pct ?? 0)) / 100),
              recurring: false,
            })),
          }
        : {}),
    },
  });

  for (const p of products) {
    await logMemberActivity(workspaceId, personId, 'membership_product_purchased', `Purchased · ${p.name}`);
  }

  // Access: the reconcile folds paid product purchases into the member's
  // entitlement, so an existing member (any status — bought grants survive
  // lapse) gets journal rows the sync workers drain. A buyer with no member
  // row gets their grants the moment one appears (same reconcile); their
  // links are delivered right away via /my and the receipt below.
  const { data: member } = await adminClient
    .from('membership_member')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('person_id', personId)
    .maybeSingle();
  if (member) await reconcileMemberAccess(member.id);

  // Receipt in the house style; the product's links ride along so the buyer
  // can reach what they bought straight from the email.
  const { data: saved } = await adminClient
    .from('purchase')
    .select(
      'payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, billing, stripe_invoice_url, organiser_user_id, app_id',
    )
    .eq('item_ref', itemRef)
    .maybeSingle();
  if (saved) {
    // Every product's links (a basket can hold several), each labelled by
    // its own product when the link has no label.
    const links = products.flatMap((p) =>
      (Array.isArray(p.links) ? (p.links as { kind?: string; ref?: string; label?: string }[]) : [])
        .filter((l) => l?.kind === 'url' && typeof l.ref === 'string' && /^https?:\/\//.test(l.ref))
        .map((l) => ({ ...l, label: l.label || p.name })),
    );
    const linksHtml = links.length
      ? `<p style="margin:24px 0 0;">${links
          .map(
            (l) =>
              `<a href="${escapeHtml(l.ref!)}" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;margin-right:8px;">${escapeHtml(l.label || product.name)}</a>`,
          )
          .join('')}</p>`
      : undefined;
    void sendReceipt(workspaceId, saved as Record<string, unknown>, undefined, undefined, linksHtml).catch(
      (e) => console.error('[membership/webhook] product receipt failed', e),
    );
  }
}

membershipRoutes.post('/stripe-webhook', async (c) => {
  const stripe = stripeOrNull();
  // Own secret, NO fallback (the billing.ts rule): a webhook verifying
  // against another endpoint's secret is an outage dressed as security.
  const secret = process.env.STRIPE_MEMBERSHIP_WEBHOOK_SECRET;
  if (!stripe || !secret) {
    console.error('[membership/webhook] not configured (key or STRIPE_MEMBERSHIP_WEBHOOK_SECRET missing)');
    return c.json({ error: 'not configured' }, 503);
  }
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'missing signature' }, 400);

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await c.req.text(), sig, secret);
  } catch (e) {
    console.error('[membership/webhook] signature verification failed', e);
    return c.json({ error: 'bad signature' }, 400);
  }

  // Membership charges live on CONNECTED accounts — this must be a Connect
  // endpoint. An event without .account is from the platform account and
  // belongs to another webhook.
  const account = (event as unknown as { account?: string }).account;
  if (!account) return c.json({ received: true, ignored: 'no connected account' });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        // One-off payment links for manual-add invoices: the metadata carries
        // the purchase id; mark it paid and mail the receipt. Idempotent —
        // the status guard makes a retry a no-op.
        if (session.mode === 'payment' && session.metadata?.membership_purchase_id) {
          const purchaseId = session.metadata.membership_purchase_id;
          const { data: paidRow } = await adminClient
            .from('purchase')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', purchaseId)
            .eq('status', 'pending')
            .select(
              'item_ref, workspace_id, payer_name, payer_email, item_label, amount_cents, currency, method, status, created_at, billing, stripe_invoice_url, organiser_user_id, app_id',
            )
            .maybeSingle();
          if (paidRow) {
            // An invoice pays for a period, so settling it moves the
            // membership too — active, renewing a period on.
            await activateMemberFromInvoice(paidRow.item_ref as string);
            void sendReceipt(paidRow.workspace_id, paidRow as Record<string, unknown>).catch((e) =>
              console.error('[membership/webhook] paid receipt failed', e),
            );
          }
          break;
        }
        // À-la-carte product purchases (distinct discriminator — this
        // branch never sees membership_purchase_id sessions, handled above).
        if (session.mode === 'payment' && session.metadata?.membership_product_id) {
          await membershipProductPurchased(account, session);
          break;
        }
        if (session.mode !== 'subscription') break;
        // Only sessions the join flow created (Thread's checkouts share
        // these accounts — metadata is the discriminator).
        if (!session.metadata?.tier_id || !session.metadata?.person_id) break;
        // Ticked add-ons FIRST: purchase rows keyed (session, product) —
        // 23505 = webhook retry, done. The subscription's own invoice.paid
        // ledger row already carries the money (the add-ons billed on the
        // first invoice), so no separate recordPurchase — a second row
        // would double-count. Recording before member convergence lets the
        // reconcile inside ensureMemberFromSubscription fold the grants in.
        if (session.metadata.option_product_ids && session.metadata.workspace_id) {
          const wsId = session.metadata.workspace_id;
          const pId = session.metadata.person_id;
          const ids = session.metadata.option_product_ids.split(',').filter(Boolean);
          const { data: prods } = await adminClient
            .from('membership_product')
            .select('id, price_cents, currency')
            .eq('workspace_id', wsId)
            .in('id', ids);
          for (const prod of prods ?? []) {
            const { error: optErr } = await adminClient.from('membership_product_purchase').insert({
              workspace_id: wsId,
              person_id: pId,
              product_id: prod.id,
              stripe_session_id: session.id,
              amount_cents: prod.price_cents ?? 0,
              currency: (prod.currency ?? 'EUR').toUpperCase(),
              status: 'paid',
            });
            if (optErr && optErr.code !== '23505') {
              console.error('[membership/webhook] option purchase insert failed', optErr);
            }
          }
        }
        const subId =
          typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
        if (subId) await ensureMemberFromSubscription(account, subId);
        break;
      }
      case 'invoice.paid':
        await membershipInvoicePaid(account, event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await membershipInvoiceFailed(account, event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.deleted':
        await membershipSubscriptionDeleted(account, event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.updated': {
        // Keep renews_at honest (plan changes, pauses, resumed dunning).
        const sub = event.data.object as Stripe.Subscription;
        const periodEnd = sub.items.data[0]?.current_period_end;
        if (periodEnd) {
          await adminClient
            .from('membership_member')
            .update({ renews_at: new Date(periodEnd * 1000).toISOString(), updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', sub.id);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    // 500 → Stripe retries. Every handler above is idempotent (member
    // upsert converges, ledger keyed on invoice id, emails deduped).
    console.error('[membership/webhook] handler failed', event.type, e);
    return c.json({ error: 'handler failed' }, 500);
  }

  return c.json({ received: true });
});

// ===========================================================================
// Renewal scheduler — rides the server.ts 5-minute tick (the
// maybeSyncVatRates pattern: added alongside, never forked).
// ===========================================================================

const REMINDER_DAYS_BEFORE = 14;
const MANUAL_GRACE_DAYS = 14;

export async function runMembershipScheduler(): Promise<{ reminded: number; graced: number; lapsed: number }> {
  const now = Date.now();
  const out = { reminded: 0, graced: 0, lapsed: 0 };

  // 1 · Upcoming-renewal reminders (active members, renews_at within 14d).
  const windowEnd = new Date(now + REMINDER_DAYS_BEFORE * 24 * 60 * 60 * 1000).toISOString();
  const { data: upcoming } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, tier_id, renews_at, stripe_subscription_id, locale')
    .eq('status', 'active')
    .not('renews_at', 'is', null)
    .gt('renews_at', new Date(now).toISOString())
    .lte('renews_at', windowEnd)
    .is('deleted_at', null);

  for (const m of upcoming ?? []) {
    // Dedup per renewal cycle: the date being warned about IS the cycle key.
    const periodRef = `renewal:${(m.renews_at as string).slice(0, 10)}`;
    const { error: dedupErr } = await adminClient
      .from('membership_reminder_send')
      .insert({ member_id: m.id, reminder_kind: 'renewal_upcoming', period_ref: periodRef });
    if (dedupErr) {
      if (dedupErr.code !== '23505') console.warn('[membership/scheduler] dedup failed', dedupErr);
      continue;
    }
    try {
      const [{ data: person }, { data: ws }, { data: tier }, brand] = await Promise.all([
        adminClient.from('person').select('first_name, email').eq('id', m.person_id).maybeSingle(),
        adminClient.from('workspace').select('name').eq('id', m.workspace_id).maybeSingle(),
        adminClient
          .from('membership_tier')
          .select('name, price_cents_year, price_cents_month, currency')
          .eq('id', m.tier_id)
          .maybeSingle(),
        getWorkspaceBrand(m.workspace_id),
      ]);
      if (!person?.email) continue;
      const msg = membershipRenewalReminder({
        name: person.first_name ?? 'there',
        communityName: ws?.name ?? 'the community',
        tierName: tier?.name ?? 'membership',
        renewsAt: m.renews_at as string,
        amountCents: tier?.price_cents_year ?? tier?.price_cents_month ?? null,
        currency: tier?.currency ?? 'EUR',
        locale: await memberEmailLocale(m.workspace_id, m.locale as string | null),
        brand: { logoUrl: brand.logoUrl, name: brand.fromName },
      });
      await sendEmail({
        to: person.email,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
        ...senderOf(brand),
      });
      out.reminded += 1;
    } catch (e) {
      console.warn('[membership/scheduler] reminder failed for member', m.id, e);
    }
  }

  // 2 · Manually-added members (no Stripe subscription — invoice/comped):
  // past renews_at → grace; 14 days past → lapsed. Stripe-backed members
  // move through the webhook instead, never here.
  const { data: overdue } = await adminClient
    .from('membership_member')
    .select('id, workspace_id, person_id, status, started_at, renews_at')
    .in('status', ['active', 'grace'])
    .is('stripe_subscription_id', null)
    .not('renews_at', 'is', null)
    .lt('renews_at', new Date(now).toISOString())
    .is('deleted_at', null);

  for (const m of overdue ?? []) {
    const renewsAtMs = new Date(m.renews_at as string).getTime();
    // A renewal date on or before the day the membership began is a data
    // error, not an overdue payment — grace-ing it tells someone who just
    // joined that they didn't pay. Leave those rows for a human to correct.
    if (new Date(m.started_at as string).getTime() >= renewsAtMs) continue;
    const pastGrace = now - renewsAtMs > MANUAL_GRACE_DAYS * 24 * 60 * 60 * 1000;
    if (m.status === 'active') {
      await adminClient
        .from('membership_member')
        .update({ status: 'grace', updated_at: new Date().toISOString() })
        .eq('id', m.id);
      await logMemberActivity(m.workspace_id, m.person_id, 'membership_payment_failed', 'Renewal overdue — grace period');
      out.graced += 1;
    } else if (pastGrace) {
      await adminClient
        .from('membership_member')
        .update({ status: 'lapsed', lapsed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', m.id);
      await logMemberActivity(m.workspace_id, m.person_id, 'membership_lapsed', 'Membership lapsed');
      await reconcileMemberAccess(m.id);
      out.lapsed += 1;
    }
  }

  // 3 · Drain the access journal (Circle invites / removals, Fibre seats).
  try {
    await runCircleAccessSync();
  } catch (e) {
    console.error('[membership/scheduler] circle sync failed', e);
  }
  try {
    await runFibreSeatSync();
  } catch (e) {
    console.error('[membership/scheduler] fibre-seat sync failed', e);
  }
  try {
    await runGoogleUserSync();
  } catch (e) {
    console.error('[membership/scheduler] google sync failed', e);
  }
  try {
    await runThreadAccessSync();
  } catch (e) {
    console.error('[membership/scheduler] thread sync failed', e);
  }

  return out;
}

// ===========================================================================
// MEMBER EMAILS, EDITABLE PER COMMUNITY (Sjoerd 2ix; Settings → Emails).
//
// A community's own words for its welcome (per tier, or a default) and its
// digest, per locale — around the FACTS, which stay ours. Reads and writes go
// through the admin's own client, so the table's RLS (admin only) is the
// enforcement; the image upload and the test send are admin-checked here and
// use the service role. Nothing changes for any member until a row exists.
// ===========================================================================

const EmailTemplateBody = z.object({
  kind: z.enum(['welcome', 'digest']),
  tier_id: z.string().uuid().nullable().optional(),
  locale: z.enum(['en', 'nl', 'es', 'pt', 'de', 'fr']),
  subject: z.string().max(200).nullable().optional(),
  image_path: z.string().max(300).nullable().optional(),
  image_alt: z.string().max(200).nullable().optional(),
  intro_html: z.string().max(20000).nullable().optional(),
  closing: z.string().max(2000).nullable().optional(),
});

const clean = (s: string | null | undefined) => (typeof s === 'string' && s.trim() ? s.trim() : null);

membershipRoutes.get('/email-templates', async (c) => {
  const db = userClient(c.get('ctx').jwt);
  const { data, error } = await db
    .from('membership_email_template')
    .select('id, kind, tier_id, locale, subject, image_path, image_alt, intro_html, closing, updated_at')
    .order('kind')
    .order('locale');
  if (error) return fail(c, 'list email templates', error);
  return c.json({ items: (data ?? []).map((r) => ({ ...r, image_url: emailImageUrl(r.image_path as string | null) })) });
});

// PUT /email-templates — save one (kind, tier-or-default, locale). Upsert by
// that key: the two partial unique indexes make a plain onConflict
// impossible, so read, then update or insert.
membershipRoutes.put('/email-templates', async (c) => {
  const body = EmailTemplateBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');
  const db = userClient(ctx.jwt);
  const d = body.data;
  const tierId = d.kind === 'welcome' ? d.tier_id ?? null : null;
  // A tier of THIS workspace — read through RLS, which shows only its own
  // (the FK alone would accept another community's tier).
  if (tierId) {
    const { data: t } = await db.from('membership_tier').select('id').eq('id', tierId).maybeSingle();
    if (!t) return c.json({ error: 'tier not found' }, 400);
  }
  // An image is ours to have uploaded: only this workspace's prefix.
  const imagePath = clean(d.image_path);
  if (imagePath && !imagePath.startsWith(`membership-email/${ctx.workspaceId}/`)) {
    return c.json({ error: 'image not found' }, 400);
  }
  if (imagePath && !clean(d.image_alt)) return c.json({ error: 'An image needs a short description (alt text).' }, 400);
  const fields = {
    subject: clean(d.subject),
    image_path: imagePath,
    image_alt: imagePath ? clean(d.image_alt) : null,
    intro_html: d.intro_html ? sanitizeRichText(d.intro_html) : null,
    closing: clean(d.closing),
    updated_at: new Date().toISOString(),
    updated_by: actorUserId(ctx),
  };
  let q = db.from('membership_email_template').select('id').eq('kind', d.kind).eq('locale', d.locale);
  q = tierId ? q.eq('tier_id', tierId) : q.is('tier_id', null);
  const { data: existing } = await q.maybeSingle();
  const res = existing
    ? await db.from('membership_email_template').update(fields).eq('id', existing.id as string).select('id').single()
    : await db
        .from('membership_email_template')
        .insert({ ...fields, workspace_id: ctx.workspaceId, kind: d.kind, tier_id: tierId, locale: d.locale })
        .select('id')
        .single();
  if (res.error) return fail(c, 'save email template', res.error);
  return c.json({ id: res.data.id });
});

// DELETE /email-templates/:id — "Reset to the standard text".
membershipRoutes.delete('/email-templates/:id', async (c) => {
  const db = userClient(c.get('ctx').jwt);
  const { data, error } = await db.from('membership_email_template').delete().eq('id', c.req.param('id')).select('id');
  if (error) return fail(c, 'reset email template', error);
  if (!data?.length) return c.json({ error: 'not found' }, 404);
  return c.body(null, 204);
});

/** The first bytes of the image formats an email may carry. */
function imageKind(b: Uint8Array): 'png' | 'jpg' | 'webp' | 'gif' | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'webp';
  return null;
}

// POST /email-templates/image — multipart "file". Images only, ≤ 2 MB, the
// bytes' own signature checked (never just the declared type); stored in the
// public EU bucket under this workspace's prefix, so mail clients can load it.
membershipRoutes.post('/email-templates/image', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) return c.json({ error: 'admin only' }, 403);
  const form = await c.req.parseBody();
  const file = form['file'];
  if (!(file instanceof File)) return c.json({ error: 'multipart field "file" required' }, 400);
  if (file.size > 2 * 1024 * 1024) return c.json({ error: 'Images up to 2 MB.' }, 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) return c.json({ error: 'A PNG, JPEG, WebP or GIF image, please.' }, 400);
  const path = `membership-email/${ctx.workspaceId}/${crypto.randomUUID()}.${kind}`;
  const mime = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' }[kind];
  const { error } = await adminClient.storage.from(EMAIL_IMAGE_BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
  if (error) return fail(c, 'upload email image', error);
  return c.json({ path, url: emailImageUrl(path) }, 201);
});

const PreviewBody = EmailTemplateBody.extend({ kind: z.enum(['welcome', 'digest']) });

/** The email as a member would get it, from a draft — the SAME templates the
 *  sends use, with a sample member and the tier's real facts. */
async function renderPreview(workspaceId: string, d: z.infer<typeof PreviewBody>) {
  const [{ data: ws }, brand] = await Promise.all([
    adminClient.from('workspace').select('name').eq('id', workspaceId).maybeSingle(),
    getWorkspaceBrand(workspaceId),
  ]);
  const communityName = (ws?.name as string | undefined) ?? 'Your community';
  const portalUrl = `${stackSurfaceUrl('my-portal', process.env)}/memberships`;
  const row = {
    id: 'preview',
    kind: d.kind,
    tier_id: d.tier_id ?? null,
    locale: d.locale,
    subject: clean(d.subject),
    image_path: clean(d.image_path),
    image_alt: clean(d.image_alt),
    intro_html: d.intro_html ? sanitizeRichText(d.intro_html) : null,
    closing: clean(d.closing),
  } as const;
  const renewsAt = new Date(Date.UTC(new Date().getUTCFullYear() + 1, 0, 1)).toISOString();
  if (d.kind === 'welcome') {
    const { data: tier } = d.tier_id
      ? await adminClient.from('membership_tier').select('name, description, characteristics').eq('id', d.tier_id).eq('workspace_id', workspaceId).maybeSingle()
      : { data: null };
    const values = memberEmailValues({ firstName: 'Marja', lastName: 'de Vries', communityName, tierName: tier?.name ?? 'Member', renewsAt, portalUrl, locale: d.locale });
    return membershipWelcome({
      name: 'Marja',
      communityName,
      tierName: tier?.name ?? 'Member',
      renewsAt,
      tierDescription: tier?.description ?? null,
      characteristics: (tier?.characteristics as string[] | null) ?? null,
      portalUrl,
      email: 'marja@example.com',
      locale: d.locale,
      brand: { logoUrl: brand.logoUrl, name: brand.fromName },
      custom: fillTemplate({ ...row }, values),
    });
  }
  const myOrigin = stackSurfaceUrl('my-portal', process.env);
  const values = memberEmailValues({ firstName: 'Marja', lastName: 'de Vries', communityName, portalUrl: `${myOrigin}/upcoming`, locale: d.locale });
  return memberNotifyDigest({
    name: 'Marja',
    communityName,
    items: [{ kind: 'new_thread', title: 'Open rehearsal', startsAt: renewsAt, yourPriceCents: 0, listPriceCents: null, currency: 'EUR' }],
    upcomingUrl: `${myOrigin}/upcoming`,
    unsubscribeUrl: `${myOrigin}/unsubscribe/preview`,
    locale: d.locale,
    brand: { logoUrl: brand.logoUrl, name: brand.fromName },
    custom: fillTemplate({ ...row }, values),
  });
}

// POST /email-templates/preview — the rendered email for the editor.
membershipRoutes.post('/email-templates/preview', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) return c.json({ error: 'admin only' }, 403);
  const body = PreviewBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const msg = await renderPreview(ctx.workspaceId, body.data);
  return c.json({ subject: msg.subject, html: msg.html });
});

// POST /email-templates/send-test — the preview, mailed to the signed-in
// admin's OWN verified address only: no address field, never a member.
membershipRoutes.post('/email-templates/send-test', async (c) => {
  const ctx = c.get('ctx');
  if (!(await isMembershipAdmin(ctx.workspaceId, ctx.userId))) return c.json({ error: 'admin only' }, 403);
  const body = PreviewBody.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const key = `email-test:${ctx.userId}`;
  if (isExhausted(key, 10)) return c.json({ error: 'A few test emails an hour — try again later.' }, 429);
  hit(key, 10, 3_600_000);
  const { data: me } = await adminClient.from('user').select('email').eq('id', ctx.userId).maybeSingle();
  if (!me?.email) return c.json({ error: 'no address on your account' }, 409);
  const msg = await renderPreview(ctx.workspaceId, body.data);
  const brand = await getWorkspaceBrand(ctx.workspaceId);
  try {
    await sendEmail({ to: me.email as string, subject: `[Test] ${msg.subject}`, html: msg.html, text: msg.text, ...senderOf(brand) });
  } catch (e) {
    // Say WHY, not a bare 500: the mail service refuses some addresses
    // outright (on 2026-10-16 the staging fixture's @example.com was refused
    // with a 422), and an admin should see that it was the address, not
    // their words.
    console.error('[membership/email-templates] test send refused', (e as Error).message);
    return c.json({ error: `The test email could not be sent to ${me.email} — the mail service refused it. Your text is fine; try again later or from another account.` }, 502);
  }
  return c.json({ sent_to: me.email });
});
