import { Hono } from 'hono';
import { FIELD_LIMITS, tooLongMessage } from '@thefibre/shared';
import { sanitizeRichText } from '../lib/rich-text.js';
import { z } from 'zod';
import { isLocale } from '@thefibre/shared';
import { adminClient } from '../db.js';
import {
  ensureProfile,
  saveProfile,
  billingFor,
  saveBilling,
} from '../lib/identity-profile.js';
import {
  accountStatus,
  authorizeUrl,
  connectClientId,
  signState,
} from '../lib/stripe/connect.js';
import { stripeOrNull } from '../lib/stripe/client.js';
import { platformFeeCents } from '../lib/fees.js';
import { personalStripeAccount } from '../lib/payment-accounts.js';
import { publicOrigin } from './mcp-discovery.js';
import { settingsUrlFor } from './workspace-billing.js';

// ===========================================================================
// The platform public profile — ONE face per user, inherited by every app
// (docs/platform-spot-members-profile.md, Phase B). Apps keep their own
// override columns; when those are null, their /me endpoints read this.
// ===========================================================================

export const profileRoutes = new Hono();

profileRoutes.get('/', async (c) => {
  const ctx = c.get('ctx');
  // Your profile follows you between workspaces; your payment details do too,
  // and they live apart because everyone in a workspace may read the first and
  // nobody but you may read the second (20260901160000).
  const [profile, billing] = await Promise.all([
    ensureProfile(ctx.userId).catch((e: unknown) => {
      console.error('[profile GET] provision failed', e);
      return null;
    }),
    billingFor(ctx.userId),
  ]);
  if (!profile) return c.json({ error: 'failed to provision profile' }, 500);
  return c.json({ ...profile, ...billing, public_page: await publicPageFor(ctx.userId) });
});

/**
 * This person's public organiser page, if they have one at all.
 *
 * Most people do not: `thread_organiser` rows exist for people who organise,
 * and for workspace admins whose workspace published a thread through an
 * external app (routes/app-thread.ts), which is how somebody ends up with a
 * public page they never asked for. Null here means there is no page and
 * nothing to decide.
 *
 * `is_published: null` is the state that matters — the row predates the
 * question (2026-10-08), the page IS public right now, and this person has
 * not been told. The settings screen shows them the notice on that.
 */
async function publicPageFor(userId: string): Promise<{
  slug: string;
  is_published: boolean | null;
  /** The SECOND, different question: do they want to appear on their
   *  organisation's page? NULL means never asked, and for this one that is
   *  treated as NO — see the column comment, and the migration for why the
   *  two defaults on this table point opposite ways. */
  listed_on_org_page: boolean | null;
} | null> {
  // TWO QUERIES, and the second one is allowed to fail.
  //
  // Measured on staging before the column existed (2026-10-11): naming
  // `listed_on_org_page` in THIS select made the whole lookup fail, the catch
  // below returned null, and the profile screen lost BOTH switches — the new
  // listing AND the publish switch people already had. A 200 with a control
  // silently missing is worse than an error, because nobody investigates it.
  //
  // It is the trap the organiser publish switch already documents in
  // routes/thread.ts: a PostgREST select naming a column the database does
  // not have fails at runtime and the row resolves as null. The fix there was
  // the same — ask separately, so an old database degrades to a sane answer
  // instead of losing everything in the same breath.
  const { data, error } = await adminClient
    .from('thread_organiser')
    .select('slug, is_published')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    // Never fatal to the profile: a settings page that will not load because
    // of one optional card is worse than a card that is missing.
    console.error('[profile GET] public page lookup failed', error.message);
    return null;
  }
  if (!data) return null;
  // Its own query. An error here means the migration has not run, and NULL is
  // the right answer anyway: before the column exists, nobody is listed.
  const { data: listing } = await adminClient
    .from('thread_organiser')
    .select('listed_on_org_page')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    slug: data.slug as string,
    is_published: data.is_published as boolean | null,
    listed_on_org_page: (listing?.listed_on_org_page as boolean | null | undefined) ?? null,
  };
}

// Every message here is written to be READ BY THE PERSON SAVING. A zod
// default ("String must contain at most 2000 character(s)") reached the
// screen as `API 400` and nothing else, which is how a save that was one
// paragraph too long looked exactly like a broken server (2026-10-03, on a
// production account, during a demo).
// A link the person types: http(s) only, so a stored value can never be a
// javascript: URL rendered as an href somewhere. Empty = cleared.
const personLink = (label: string) =>
  z
    .string()
    .trim()
    .max(FIELD_LIMITS.website, tooLongMessage(label, FIELD_LIMITS.website))
    .refine((v) => v === '' || /^https?:\/\/[^\s]+\.[^\s]+$/i.test(v), `${label} must start with https://`)
    .nullable()
    .optional();

/** The person's own city and links — one profile (20261016162613), shared by
 *  Settings → Profile here and my.thread → You → Profile (routes/portal.ts).
 *  An emptied field is stored as null by `nullEmptyFace`. */
export const ProfileWhereabouts = {
  city: z
    .string()
    .trim()
    .max(FIELD_LIMITS.city, tooLongMessage('A city', FIELD_LIMITS.city))
    .nullable()
    .optional(),
  website_url: personLink('A website'),
  linkedin_url: personLink('A LinkedIn link'),
};

/** '' means "not written": stored as null, never as the empty string. */
export function nullEmptyFace<T extends Record<string, unknown>>(face: T): T {
  for (const k of ['short_bio', 'city', 'website_url', 'linkedin_url'] as const) {
    if ((face as Record<string, unknown>)[k] === '') (face as Record<string, unknown>)[k] = null;
  }
  return face;
}

export const ProfilePatch = z.object({
  ...ProfileWhereabouts,
  display_name: z
    .string()
    .max(FIELD_LIMITS.display_name, tooLongMessage('A display name', FIELD_LIMITS.display_name))
    .nullable()
    .optional(),
  bio: z
    .string()
    .max(FIELD_LIMITS.bio, tooLongMessage('A bio', FIELD_LIMITS.bio))
    .nullable()
    .optional(),
  // The short bio: plain text, a few lines for compact spots. Trimmed BEFORE
  // the length check, so trailing whitespace the person cannot see never
  // counts against them; an emptied one is stored as null below.
  short_bio: z
    .string()
    .trim()
    .max(FIELD_LIMITS.short_bio, tooLongMessage('A short bio', FIELD_LIMITS.short_bio))
    .nullable()
    .optional(),
  photo_url: z
    .string()
    .max(FIELD_LIMITS.photo_url, tooLongMessage('A photo URL', FIELD_LIMITS.photo_url))
    .nullable()
    .optional(),
  // Nullable because the callers send `timezone || null` when the field is
  // empty. It was the only field here that refused null, which made an empty
  // picker a 400 with no explanation.
  timezone: z.string().max(FIELD_LIMITS.timezone).nullable().optional(),
  // ONE user-level UI/email language (i18n P2, D1). Validated against the
  // shared LOCALES so the list has a single source; null = no preference.
  locale: z
    .string()
    .max(FIELD_LIMITS.locale)
    .nullable()
    .optional()
    .refine((v) => v == null || isLocale(v), 'unsupported locale'),
  // Whether this person wants the To do panel at all (Sjoerd, 2026-09-23:
  // an ON/OFF, in "profile settings"). Per person, not per workspace.
  todo_enabled: z.boolean().optional(),
  // Payments SPoT (personal level) — every app reads these.
  stripe_account_id: z
    .string()
    .max(
      FIELD_LIMITS.stripe_account_id,
      tooLongMessage('A Stripe account id', FIELD_LIMITS.stripe_account_id),
    )
    .regex(/^(acct_[A-Za-z0-9]+)?$/, 'Must be a Stripe account id like acct_…')
    .nullable()
    .optional(),
  invoice_details: z
    .object({
      // The same numbers the form counts against (FIELD_LIMITS), so a save
      // the browser allowed cannot be refused here for a length nobody was
      // shown.
      legal_name: z
        .string()
        .max(FIELD_LIMITS.legal_name, tooLongMessage('A legal name', FIELD_LIMITS.legal_name))
        .optional(),
      address: z
        .string()
        .max(FIELD_LIMITS.address, tooLongMessage('An address', FIELD_LIMITS.address))
        .optional(),
      tax_no: z
        .string()
        .max(FIELD_LIMITS.tax_no, tooLongMessage('A tax number', FIELD_LIMITS.tax_no))
        .optional(),
      website: z
        .string()
        .max(FIELD_LIMITS.website, tooLongMessage('A website', FIELD_LIMITS.website))
        .optional(),
      vat_registered: z.boolean().optional(),
      vat_rate_pct: z.number().min(0).max(100).nullable().optional(),
    })
    .nullable()
    .optional(),
  default_payment_methods: z.array(z.enum(['stripe', 'invoice'])).nullable().optional(),
  /** The public page switch. Not nullable on the way in: a person answering
   *  says yes or no, and "back to never having been asked" is not an answer
   *  anybody gives. */
  public_page_published: z.boolean().optional(),
  /** Appearing on your organisation's page is its own answer, so it is its
   *  own field rather than a second meaning for the one above. */
  listed_on_org_page: z.boolean().optional(),
});

profileRoutes.patch('/', async (c) => {
  const body = ProfilePatch.safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: body.error.flatten() }, 400);
  const ctx = c.get('ctx');

  const {
    stripe_account_id,
    invoice_details,
    default_payment_methods,
    public_page_published,
    listed_on_org_page,
    ...face
  } =
    body.data;

  // The bio is becoming rich text, so it is cleaned where it ENTERS — the
  // rule lib/rich-text.ts states and the reason it gives: the way out is
  // eight surfaces and only one of them has to forget. Today every bio is
  // still plain text, which DOMPurify leaves alone, so this is a no-op until
  // the editor flips. `|| null` keeps an emptied bio empty rather than
  // storing '<p></p>'.
  if (typeof face.bio === 'string') face.bio = sanitizeRichText(face.bio);
  // Empty means "not written", which readers turn into the bio's opening
  // (resolveShortBio). '' would read as written-and-blank.
  nullEmptyFace(face);

  if (Object.keys(face).length) {
    const r = await saveProfile(ctx.userId, face);
    if (r.error) return c.json({ error: r.error }, 500);
  }

  if (public_page_published !== undefined) {
    // Scoped to THIS person's row by user_id. The column is theirs to set and
    // nobody else's — there is no admin path to publish somebody's page for
    // them, deliberately.
    const { error } = await adminClient
      .from('thread_organiser')
      .update({ is_published: public_page_published })
      .eq('user_id', ctx.userId);
    if (error) {
      console.error('[profile PATCH] public page switch failed', error.message);
      return c.json({ error: 'could not change your public page' }, 500);
    }
  }

  if (listed_on_org_page !== undefined) {
    // Same scoping, same reason: theirs to set and nobody else's. An admin
    // cannot add somebody to the organisation page, which is the entire
    // point of asking.
    const { error } = await adminClient
      .from('thread_organiser')
      .update({ listed_on_org_page })
      .eq('user_id', ctx.userId);
    if (error) {
      console.error('[profile PATCH] org listing switch failed', error.message);
      return c.json({ error: 'could not change your listing' }, 500);
    }
  }

  const billing: Record<string, unknown> = {};
  if (stripe_account_id !== undefined) billing.stripe_account_id = stripe_account_id || null;
  if (invoice_details !== undefined) billing.invoice_details = invoice_details;
  if (default_payment_methods !== undefined) {
    billing.default_payment_methods = default_payment_methods;
  }
  if (Object.keys(billing).length) {
    const r = await saveBilling(ctx.userId, billing);
    if (r.error) return c.json({ error: r.error }, 500);
  }

  // The payments SPoT still falls back to the app-local columns, so a write
  // here — a DISCONNECT above all — has to overwrite them, or clearing the
  // platform value resurrects the old account.
  if (stripe_account_id !== undefined) {
    const value = stripe_account_id || null;
    await adminClient.from('meet_host').update({ stripe_account_id: value }).eq('user_id', ctx.userId);
    await adminClient
      .from('thread_organiser')
      .update({ stripe_account_id: value })
      .eq('user_id', ctx.userId);
  }

  const [profile, saved] = await Promise.all([
    ensureProfile(ctx.userId),
    billingFor(ctx.userId),
  ]);
  return c.json({ ...profile, ...saved });
});


// ===========================================================================
// Stripe Connect for the PERSONAL (organiser) account.
//
// Sjoerd, 2026-09-24: *"And why does the personal account not have to connect
// like this?"* It does. It had the same defect the workspace had and for the
// same reason — a text box holding `acct_…` grants the platform nothing, so a
// personal account belonging to anyone but the platform owner could never
// take a payment, while the screen said it was fine. The workspace half was
// built first only because that is where soul.com was stuck.
//
// The callback is shared with the workspace flow
// (/api/v1/workspace-billing/stripe/callback): Stripe matches redirect_uri
// against a hand-maintained list per mode, and the signed `state` already
// says which scope this is.
// ===========================================================================

function personalRedirectUri(headers: Headers): string {
  return `${publicOrigin(headers)}/api/v1/workspace-billing/stripe/callback`;
}

profileRoutes.get('/stripe/connect', async (c) => {
  const ctx = c.get('ctx');
  const clientId = connectClientId();
  if (!clientId) {
    return c.json({ error: 'this platform is not registered with Stripe Connect yet' }, 503);
  }
  return c.json({
    url: authorizeUrl(
      clientId,
      signState('personal', ctx.userId, ctx.appId),
      personalRedirectUri(c.req.raw.headers),
    ),
  });
});

profileRoutes.get('/stripe/status', async (c) => {
  const ctx = c.get('ctx');
  const accountId = await personalStripeAccount(ctx.userId);
  const status = await accountStatus(accountId);
  return c.json({
    account_id: accountId,
    connect_available: Boolean(connectClientId()),
    ...status,
  });
});

/** The same rehearsal as the workspace one, on the organiser's own account. */
profileRoutes.post('/stripe/test-payment', async (c) => {
  const ctx = c.get('ctx');
  const stripe = stripeOrNull();
  if (!stripe) return c.json({ error: 'payments are not configured' }, 503);

  const parsed = z
    .object({ amount_cents: z.number().int().min(50).max(100_000) })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) {
    return c.json({ error: 'choose an amount between 0.50 and 1000.00' }, 400);
  }
  const amountCents = parsed.data.amount_cents;

  const account = await personalStripeAccount(ctx.userId);
  if (!account) return c.json({ error: 'connect a Stripe account first' }, 400);

  const { data: ws } = await adminClient
    .from('workspace')
    .select('default_currency')
    .eq('id', ctx.workspaceId)
    .maybeSingle();
  const back = settingsUrlFor(ctx.appId);

  try {
    const session = await stripe.checkout.sessions.create(
      {
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: (ws?.default_currency || 'EUR').toLowerCase(),
              unit_amount: amountCents,
              product_data: { name: 'Test payment' },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          application_fee_amount: await platformFeeCents(ctx.workspaceId, amountCents, account),
          metadata: { fibre_test: 'true', user_id: ctx.userId },
        },
        metadata: { fibre_test: 'true', user_id: ctx.userId },
        success_url: `${back}?stripe=test_paid`,
        cancel_url: `${back}?stripe=test_cancelled`,
      },
      { stripeAccount: account },
    );
    if (!session.url) return c.json({ error: 'Stripe did not return a checkout page' }, 502);
    return c.json({ url: session.url });
  } catch (e) {
    const detail = e instanceof Error ? e.message : 'could not reach Stripe';
    console.error('[profile] test payment failed', e);
    return c.json({ error: detail }, 502);
  }
});
