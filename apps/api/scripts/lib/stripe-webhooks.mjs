// Every Stripe webhook this API answers, and what Stripe must be told to send
// it — the ONE list (2026-09-14). verify-stripe-webhooks.mjs reads it to
// audit a project; register-stripe-webhooks.mjs reads it to make the project
// match. Before, the audit script owned the list and fixing a finding meant
// retyping it in the dashboard, where the mode is fixed at creation and easy
// to get wrong a second time.
//
// `connect` is the one that bites: charges on a CONNECTED account only reach
// an endpoint created in connected-account mode. An endpoint in the wrong
// mode looks healthy in the dashboard and delivers nothing the route can use
// (routes/membership.ts drops anything without `.account`, silently and
// correctly). Born 2026-09-09 from soul.com's first live invoiced member.
//
// `secretEnv` is the Fly secret each route verifies signatures against
// (grep WEBHOOK_SECRET under src/routes). Meet reads the unprefixed one for
// historical reasons; Thread falls back to it when its own is unset.

export const EXPECTED = [
  {
    path: '/api/v1/membership/stripe-webhook',
    connect: true,
    secretEnv: 'STRIPE_MEMBERSHIP_WEBHOOK_SECRET',
    why: 'membership charges run on the workspace’s connected account',
    events: [
      'checkout.session.completed',
      'invoice.paid',
      'invoice.payment_failed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
    ],
  },
  {
    path: '/api/v1/thread/stripe-webhook',
    connect: true,
    secretEnv: 'STRIPE_THREAD_WEBHOOK_SECRET',
    why: 'thread enrolments are paid to the organiser’s connected account',
    events: ['checkout.session.completed', 'checkout.session.expired'],
  },
  {
    path: '/api/v1/meet/stripe-webhook',
    connect: true,
    secretEnv: 'STRIPE_WEBHOOK_SECRET',
    why: 'meet bookings are paid to the host’s connected account',
    events: [
      'checkout.session.completed',
      'checkout.session.expired',
      'payment_intent.payment_failed',
    ],
  },
  {
    path: '/api/v1/billing/stripe-webhook',
    connect: false,
    secretEnv: 'STRIPE_BILLING_WEBHOOK_SECRET',
    why: 'Fibre’s own subscriptions are charged on the platform account',
    events: [
      'checkout.session.completed',
      'customer.subscription.updated',
      'customer.subscription.deleted',
      'invoice.paid',
      'invoice.payment_failed',
    ],
  },
];

/**
 * Is this endpoint listening on CONNECTED accounts? Stripe does not echo the
 * `connect` flag back on the object; a Connect endpoint carries the
 * platform's Connect `application` id instead. Reading `e.connect` — which
 * the verifier did until 2026-09-14 — reports every endpoint as platform
 * mode, including the correct ones. (The three staging endpoints recreated
 * that night therefore may have been right before, too; unknowable now.)
 */
export function isConnectEndpoint(e) {
  return e.connect === true || Boolean(e.application);
}

/** Hosts that are ours; an endpoint elsewhere on them is a stray. */
export const OUR_HOSTS = /thefibre-api|thefibre\.app|thethread\.app/;

/** A minimal Stripe REST client — no SDK so a restricted key and `fetch` suffice. */
export function stripeClient(key) {
  return async function stripe(path, { method = 'GET', body, account } = {}) {
    const res = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
        ...(account ? { 'Stripe-Account': account } : {}),
      },
      body: body ? form(body) : undefined,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status} on ${path}`);
    return json;
  };
}

// Stripe's form encoding: arrays as key[0]=…, key[1]=…
function form(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) v.forEach((x, i) => p.set(`${k}[${i}]`, String(x)));
    else if (v !== undefined && v !== null) p.set(k, String(v));
  }
  return p;
}

export function modeOf(key) {
  return key.includes('_test_') ? 'TEST' : 'LIVE';
}
