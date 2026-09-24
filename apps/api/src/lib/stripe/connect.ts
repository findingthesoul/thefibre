// Stripe Connect onboarding — the half that was never built.
//
// Until 2026-09-24 the ONLY way a workspace got a Stripe account was an admin
// typing `acct_…` into a text box (routes/workspace-billing.ts). Storing a
// number grants nothing: Connect is a permission the account holder gives the
// platform, and nobody was ever asked for it. So a genuinely third-party
// account could never take a payment, and the settings screen said
// "Connected" regardless, because that badge only ever meant "the field is
// not empty".
//
// It survived because it works perfectly for accounts belonging to the SAME
// Stripe user as the platform — acting on your own account needs no grant.
// Every test before soul.com was on Sjoerd's own accounts. soul.com is the
// first separate company, and it sat on a live join page for two weeks
// answering "could not start checkout" while the screen showed green.
//
// Sjoerd, 2026-09-24: "If I have to manually add every workspace to my
// account in order to let them receive payments, then that is not a
// platform." Correct, and this is the fix: the client connects themselves,
// from their own Stripe, and the platform is never in the loop.
//
// Standard OAuth, not Express onboarding, deliberately: soul.com already HAS
// a Stripe account with its own history, bank details and dashboard, and
// Standard connects an existing account rather than creating a managed one.

import { createHmac, timingSafeEqual } from 'node:crypto';

const AUTHORIZE_URL = 'https://connect.stripe.com/oauth/authorize';
const TOKEN_URL = 'https://connect.stripe.com/oauth/token';
const DEAUTHORIZE_URL = 'https://connect.stripe.com/oauth/deauthorize';

/** Set once by Sjoerd from Stripe → Connect → Settings. Absent = the whole
 *  feature stays dark and the UI says so, rather than half-working. */
export function connectClientId(): string | null {
  return process.env.STRIPE_CONNECT_CLIENT_ID || null;
}

function stateSecret(): string {
  const s = process.env.SSO_INTERNAL_SECRET;
  if (!s) throw new Error('SSO_INTERNAL_SECRET is not set');
  return s;
}

/**
 * `state` is the CSRF defence and it has to be unforgeable: without it anyone
 * could hand an admin a crafted return URL and bind somebody else's Stripe
 * account to their workspace. So it carries the workspace and an expiry, and
 * is signed with a key that never leaves the API.
 */
export type ConnectScope = 'workspace' | 'personal';

export function signState(
  scope: ConnectScope,
  /** The workspace id, or the user id for a personal account. */
  subjectId: string,
  /** The app the admin started from, so the callback can send them back to
   *  the settings page they left — and to the STACK they left it on. */
  appId: string,
  ttlMs = 15 * 60 * 1000,
): string {
  const body = `${scope}.${subjectId}.${appId}.${Date.now() + ttlMs}`;
  const mac = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  return `${Buffer.from(body).toString('base64url')}.${mac}`;
}

export function verifyState(
  state: string,
): { scope: ConnectScope; subjectId: string; appId: string | null } | null {
  const [encoded, mac] = state.split('.');
  if (!encoded || !mac) return null;
  let body: string;
  try {
    body = Buffer.from(encoded, 'base64url').toString('utf8');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', stateSecret()).update(body).digest('base64url');
  // Length check first: timingSafeEqual throws on a mismatch rather than
  // returning false.
  if (mac.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;

  // The body has grown twice in one day, and a state signed by the PREVIOUS
  // build is still inside its 15 minutes when the new one deploys. Stranding
  // an admin who is at that moment standing in Stripe's approval screen is a
  // worse failure than carrying two dead shapes for a quarter of an hour, so
  // every shape that ever existed is still read:
  //   4 parts  scope.subject.app.expiry   (now)
  //   3 parts  workspace.app.expiry       (v1.27.6)
  //   2 parts  workspace.expiry           (v1.27.0)
  const p = body.split('.');
  let scope: ConnectScope = 'workspace';
  let subjectId: string | undefined;
  let appId: string | undefined;
  let expiry: string | undefined;
  if (p.length === 4) {
    if (p[0] !== 'workspace' && p[0] !== 'personal') return null;
    [scope, subjectId, appId, expiry] = [p[0], p[1], p[2], p[3]];
  } else if (p.length === 3) {
    [subjectId, appId, expiry] = [p[0], p[1], p[2]];
  } else if (p.length === 2) {
    [subjectId, expiry] = [p[0], p[1]];
  } else {
    return null;
  }
  if (!subjectId || !expiry || Number(expiry) < Date.now()) return null;
  return { scope, subjectId, appId: appId ?? null };
}

export function authorizeUrl(clientId: string, state: string, redirectUri: string): string {
  const u = new URL(AUTHORIZE_URL);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', clientId);
  // read_write: the platform creates charges on the account. Connect offers
  // read_only, which cannot take a payment and would rebuild this bug.
  u.searchParams.set('scope', 'read_write');
  u.searchParams.set('state', state);
  u.searchParams.set('redirect_uri', redirectUri);
  return u.toString();
}

/** Exchange the one-time code for the connected account id. The platform's
 *  own secret key is the client secret — Stripe's OAuth uses it directly. */
export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ accountId: string } | { error: string }> {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { error: 'payments are not configured' };
  try {
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_secret: secret,
        redirect_uri: redirectUri,
      }),
    });
    const body = (await res.json()) as {
      stripe_user_id?: string;
      error_description?: string;
      error?: string;
    };
    if (!res.ok || !body.stripe_user_id) {
      return { error: body.error_description ?? body.error ?? `Stripe returned ${res.status}` };
    }
    return { accountId: body.stripe_user_id };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'could not reach Stripe' };
  }
}

/** Give the permission back when a workspace disconnects. Best-effort: the
 *  row is cleared either way, because leaving a stale id behind is the worse
 *  failure — it is what made the old field lie. */
export async function deauthorize(accountId: string): Promise<void> {
  const secret = process.env.STRIPE_SECRET_KEY;
  const clientId = connectClientId();
  if (!secret || !clientId) return;
  try {
    await fetch(DEAUTHORIZE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Bearer ${secret}`,
      },
      body: new URLSearchParams({ client_id: clientId, stripe_user_id: accountId }),
    });
  } catch {
    /* the row is cleared regardless */
  }
}

/**
 * Can the platform actually reach this account? THE question the old badge
 * never asked. Three states, because "saved but unreachable" is the one the
 * product was missing and the one soul.com was in.
 */
export async function accountStatus(
  accountId: string | null,
): Promise<
  | { state: 'none' }
  | {
      state: 'connected';
      chargesEnabled: boolean;
      detail: string | null;
      /** Whose account this is, in Stripe's own words. Sjoerd, 2026-09-24:
       *  *"get that from Stripe (so it is clearly the right account)"* —
       *  "Connected" without a name is the same empty reassurance the old
       *  green badge gave, one step further along. With four clients each
       *  connecting their own Stripe, the question is never whether AN
       *  account is attached; it is whether it is THEIRS. */
      accountName: string | null;
      accountEmail: string | null;
      accountCountry: string | null;
    }
  | { state: 'unreachable'; detail: string }
> {
  if (!accountId) return { state: 'none' };
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) return { state: 'unreachable', detail: 'payments are not configured' };
  try {
    const res = await fetch(`https://api.stripe.com/v1/accounts/${accountId}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = (await res.json()) as {
      charges_enabled?: boolean;
      requirements?: { disabled_reason?: string | null };
      // The trade name first, then what Stripe shows on their own dashboard,
      // then the account email — the order a person would recognise.
      business_profile?: { name?: string | null } | null;
      settings?: { dashboard?: { display_name?: string | null } | null } | null;
      email?: string | null;
      country?: string | null;
      error?: { message?: string };
    };
    if (!res.ok) {
      return { state: 'unreachable', detail: body.error?.message ?? `Stripe returned ${res.status}` };
    }
    return {
      state: 'connected',
      chargesEnabled: Boolean(body.charges_enabled),
      detail: body.requirements?.disabled_reason ?? null,
      accountName:
        body.business_profile?.name ||
        body.settings?.dashboard?.display_name ||
        null,
      accountEmail: body.email ?? null,
      accountCountry: body.country ?? null,
    };
  } catch (e) {
    return { state: 'unreachable', detail: e instanceof Error ? e.message : 'could not reach Stripe' };
  }
}
