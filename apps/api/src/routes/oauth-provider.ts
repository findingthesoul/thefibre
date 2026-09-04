import { Hono } from 'hono';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { adminClient } from '../db.js';

// ===========================================================================
// The Fibre as OAuth2 provider — Circle SSO SPIKE (2026-09-05).
//
// Shaped to fit Circle.so's named-preset SSO, specifically the
// "WordPress (WP-OAuth)" preset, which speaks plain OAuth2 against a server
// URL you supply: GET /oauth/authorize → POST /oauth/token → GET /oauth/me.
// Mounted at /api/v1/oauth (server.ts), auth bypassed in
// middleware/app-context.ts — every endpoint here carries its own auth.
//
// The point of the spike: /oauth/me only ever answers for an email that
// holds an ACTIVE or GRACE membership_member in the client's workspace.
// Membership lapses → sign-in to Circle stops working. That IS the SSO.
//
// Flow (docs/spike-circle-sso.md is the full writeup):
//   1. Circle sends the browser to GET /authorize?client_id&redirect_uri&
//      response_type=code&state.
//   2. We validate the client and 302 to the membership app's
//      /oauth-continue page, which requires a Supabase sign-in.
//   3. That page calls POST /continue with the user's Supabase JWT; we
//      verify it (JWKS — the participantEmailFromAuth pattern from
//      thread.ts), gate on membership, mint a single-use 60s code, and hand
//      back the redirect URL. The page window.location's to Circle.
//   4. Circle exchanges the code at POST /token (client_secret_post) for a
//      15-minute HS256 JWT signed with SSO_INTERNAL_SECRET — stateless, so
//      no token table.
//   5. Circle reads GET /me with that token; we re-check the membership is
//      still active and answer in WP-OAuth's user shape.
//
// oauth_client / oauth_code are service-role-only tables (RLS enabled, no
// policies — the membership_settings precedent); everything here runs on
// adminClient with explicit filters.
// ===========================================================================

export const oauthProviderRoutes = new Hono();

const MEMBERSHIP_APP_URL =
  process.env.MEMBERSHIP_APP_URL ?? 'https://membership.thefibre.app';

const CODE_TTL_MS = 60 * 1000; // single-use codes live 60 seconds
const TOKEN_TTL_S = 900; // access tokens live 15 minutes

// --- Supabase JWT verification (the participantEmailFromAuth pattern) ------

const memberJwks = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createRemoteJWKSet(
      new URL(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
      ),
    )
  : null;

async function memberEmailFromAuth(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<string | null> {
  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ') || !memberJwks) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), memberJwks, {
      audience: process.env.API_JWT_AUDIENCE ?? 'authenticated',
    });
    return (payload.email as string | undefined) ?? null;
  } catch {
    return null;
  }
}

// --- Helpers ---------------------------------------------------------------

function sha256hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function secretMatches(secret: string, storedHash: string): boolean {
  const a = Buffer.from(sha256hex(secret), 'utf8');
  const b = Buffer.from(storedHash, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

type OAuthClient = {
  id: string;
  workspace_id: string;
  name: string;
  client_id: string;
  client_secret_hash: string;
  redirect_uris: string[];
};

async function loadClient(clientId: string): Promise<OAuthClient | null> {
  const { data, error } = await adminClient
    .from('oauth_client')
    .select('id, workspace_id, name, client_id, client_secret_hash, redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) {
    console.error('[oauth] oauth_client lookup failed', error);
    return null;
  }
  return (data as OAuthClient | null) ?? null;
}

function redirectUriAllowed(client: OAuthClient, uri: string): boolean {
  return client.redirect_uris.includes(uri);
}

type MemberIdentity = {
  personId: string;
  displayName: string;
  createdAt: string;
};

/**
 * The membership gate — the point of the spike. An email resolves to a
 * member only when a person in the client's workspace carries that email
 * (primary or secondary; person.email is citext, so matching is
 * case-insensitive) AND a membership_member row for that person is ACTIVE
 * or GRACE. Everything else → null → 403.
 */
async function activeMemberByEmail(
  workspaceId: string,
  email: string,
): Promise<MemberIdentity | null> {
  const findPersons = (column: 'email' | 'email_secondary') =>
    adminClient
      .from('person')
      .select('id, first_name, last_name, preferred_name, created_at')
      .eq('workspace_id', workspaceId)
      .eq(column, email)
      .is('deleted_at', null);

  let { data: persons, error } = await findPersons('email');
  if (!error && (!persons || persons.length === 0)) {
    ({ data: persons, error } = await findPersons('email_secondary'));
  }
  if (error) {
    console.error('[oauth] person lookup failed', error);
    return null;
  }
  if (!persons || persons.length === 0) return null;

  const { data: members, error: mErr } = await adminClient
    .from('membership_member')
    .select('id, person_id, status')
    .eq('workspace_id', workspaceId)
    .in(
      'person_id',
      persons.map((p) => p.id),
    )
    .in('status', ['active', 'grace'])
    .is('deleted_at', null)
    .limit(1);
  if (mErr) {
    console.error('[oauth] membership_member lookup failed', mErr);
    return null;
  }
  const activeMember = members?.[0];
  if (!activeMember) return null;

  const person =
    persons.find((p) => p.id === activeMember.person_id) ?? persons[0];
  if (!person) return null;
  const displayName =
    person.preferred_name ||
    [person.first_name, person.last_name].filter(Boolean).join(' ') ||
    email;
  return {
    personId: person.id as string,
    displayName,
    createdAt: (person.created_at as string) ?? new Date().toISOString(),
  };
}

function requireInternalSecret(): string {
  const secret = process.env.SSO_INTERNAL_SECRET;
  if (!secret) throw new Error('SSO_INTERNAL_SECRET is not set');
  return secret;
}

// Minimal branded error page — /authorize is a browser-facing endpoint, so
// errors there should be readable, not JSON.
function errorPage(title: string, detail: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title} · The Fibre</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#fafaf9;color:#1c1917;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{max-width:26rem;padding:2rem}h1{font-size:1.1rem;font-weight:600;margin:0 0 .5rem}
p{font-size:.9rem;line-height:1.5;color:#57534e;margin:0}.wm{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:#a8a29e;margin-bottom:2rem}</style>
</head><body><main><div class="wm">The Fibre</div><h1>${title}</h1><p>${detail}</p></main></body></html>`;
}

// ---------------------------------------------------------------------------
// GET /authorize — entry point. Circle sends the member's browser here.
// ---------------------------------------------------------------------------

oauthProviderRoutes.get('/authorize', async (c) => {
  const clientId = c.req.query('client_id');
  const redirectUri = c.req.query('redirect_uri');
  const responseType = c.req.query('response_type');
  const state = c.req.query('state');

  if (!clientId || !redirectUri) {
    return c.html(
      errorPage('Sign-in request invalid', 'Missing client_id or redirect_uri.'),
      400,
    );
  }
  const client = await loadClient(clientId);
  if (!client) {
    return c.html(errorPage('Unknown application', 'This client_id is not registered with The Fibre.'), 400);
  }
  if (!redirectUriAllowed(client, redirectUri)) {
    // Never redirect to an unregistered URI — render, don't bounce.
    return c.html(
      errorPage('Redirect not allowed', 'The redirect_uri does not match what is registered for this application.'),
      400,
    );
  }
  if (responseType && responseType !== 'code') {
    return c.html(errorPage('Unsupported response type', 'Only response_type=code is supported.'), 400);
  }

  // Hand the browser to the membership app, which owns the sign-in UI.
  const next = new URL(`${MEMBERSHIP_APP_URL}/oauth-continue`);
  next.searchParams.set('client_id', clientId);
  next.searchParams.set('redirect_uri', redirectUri);
  if (state) next.searchParams.set('state', state);
  return c.redirect(next.toString(), 302);
});

// ---------------------------------------------------------------------------
// POST /continue — called by the membership app's /oauth-continue page with
// the signed-in user's Supabase JWT. Gates on membership, mints the code.
// ---------------------------------------------------------------------------

oauthProviderRoutes.post('/continue', async (c) => {
  const email = await memberEmailFromAuth(c);
  if (!email) return c.json({ error: 'unauthenticated' }, 401);

  const body = (await c.req.json().catch(() => null)) as {
    client_id?: string;
    redirect_uri?: string;
    state?: string;
  } | null;
  if (!body?.client_id || !body.redirect_uri) {
    return c.json({ error: 'client_id and redirect_uri are required' }, 400);
  }

  const client = await loadClient(body.client_id);
  if (!client || !redirectUriAllowed(client, body.redirect_uri)) {
    return c.json({ error: 'unknown client or redirect_uri' }, 400);
  }

  const member = await activeMemberByEmail(client.workspace_id, email);
  if (!member) {
    // The point of the whole exercise: no active/grace membership, no entry.
    return c.json(
      {
        error: 'membership_inactive',
        message: 'Your membership is not active.',
      },
      403,
    );
  }

  const code = randomBytes(32).toString('base64url');
  const { error } = await adminClient.from('oauth_code').insert({
    code,
    client_id: client.client_id,
    member_email: email,
    redirect_uri: body.redirect_uri,
    expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
  });
  if (error) {
    console.error('[oauth] oauth_code insert failed', error);
    return c.json({ error: 'could not mint code' }, 500);
  }

  const redirect = new URL(body.redirect_uri);
  redirect.searchParams.set('code', code);
  if (body.state) redirect.searchParams.set('state', body.state);
  return c.json({ redirect: redirect.toString() });
});

// ---------------------------------------------------------------------------
// POST /token — authorization_code exchange. WP-OAuth clients send
// client_secret_post (credentials in the form body); Basic auth accepted
// too. Accepts form-encoded (the OAuth2 norm) and JSON bodies.
// ---------------------------------------------------------------------------

oauthProviderRoutes.post('/token', async (c) => {
  let params: Record<string, string> = {};
  const contentType = c.req.header('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await c.req.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (body) {
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === 'string') params[k] = v;
      }
    }
  } else {
    // application/x-www-form-urlencoded (and multipart, which parseBody
    // also handles).
    const body = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
    for (const [k, v] of Object.entries(body)) {
      if (typeof v === 'string') params[k] = v;
    }
  }

  // client_secret_basic support: Authorization: Basic base64(id:secret).
  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Basic ')) {
    try {
      const [id, ...rest] = Buffer.from(authHeader.slice(6), 'base64')
        .toString('utf8')
        .split(':');
      if (id && rest.length) {
        params.client_id ??= decodeURIComponent(id);
        params.client_secret ??= decodeURIComponent(rest.join(':'));
      }
    } catch {
      /* malformed Basic header → fall through to the param check */
    }
  }

  const { grant_type, code, client_id, client_secret, redirect_uri } = params;
  if (grant_type !== 'authorization_code') {
    return c.json({ error: 'unsupported_grant_type' }, 400);
  }
  if (!code || !client_id || !client_secret) {
    return c.json({ error: 'invalid_request' }, 400);
  }

  const client = await loadClient(client_id);
  if (!client || !secretMatches(client_secret, client.client_secret_hash)) {
    return c.json({ error: 'invalid_client' }, 401);
  }

  const { data: codeRow, error } = await adminClient
    .from('oauth_code')
    .select('code, client_id, member_email, redirect_uri, expires_at, used_at')
    .eq('code', code)
    .eq('client_id', client_id)
    .maybeSingle();
  if (error) {
    console.error('[oauth] oauth_code lookup failed', error);
    return c.json({ error: 'server_error' }, 500);
  }
  if (
    !codeRow ||
    codeRow.used_at ||
    new Date(codeRow.expires_at).getTime() < Date.now() ||
    (redirect_uri && redirect_uri !== codeRow.redirect_uri)
  ) {
    return c.json({ error: 'invalid_grant' }, 400);
  }

  // Single use — mark before issuing, and refuse if someone beat us to it
  // (the .is('used_at', null) filter makes the race safe: second caller
  // updates zero rows).
  const { data: claimed, error: claimErr } = await adminClient
    .from('oauth_code')
    .update({ used_at: new Date().toISOString() })
    .eq('code', code)
    .is('used_at', null)
    .select('code');
  if (claimErr || !claimed || claimed.length === 0) {
    return c.json({ error: 'invalid_grant' }, 400);
  }

  // Stateless access token: HS256 JWT, 15 min, signed with the internal
  // secret. /me verifies it without any token table.
  const secret = new TextEncoder().encode(requireInternalSecret());
  const accessToken = await new SignJWT({
    email: codeRow.member_email,
    client_id,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('thefibre-oauth')
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_S}s`)
    .sign(secret);

  return c.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: TOKEN_TTL_S,
    scope: 'basic',
  });
});

// ---------------------------------------------------------------------------
// GET /me — user info. WP-OAuth's client sends ?access_token=…; Bearer
// header accepted too. Answers the WP user shape UNION generic OIDC-ish
// claims, and re-checks the membership is still active on every call.
// ---------------------------------------------------------------------------

oauthProviderRoutes.on(['GET', 'POST'], '/me', async (c) => {
  const auth = c.req.header('authorization');
  const raw = auth?.startsWith('Bearer ')
    ? auth.slice(7)
    : c.req.query('access_token');
  if (!raw) return c.json({ error: 'invalid_token' }, 401);

  let email: string;
  let clientId: string;
  try {
    const secret = new TextEncoder().encode(requireInternalSecret());
    const { payload } = await jwtVerify(raw, secret, {
      algorithms: ['HS256'],
      issuer: 'thefibre-oauth',
    });
    email = payload.email as string;
    clientId = payload.client_id as string;
    if (!email || !clientId) throw new Error('missing claims');
  } catch {
    return c.json({ error: 'invalid_token' }, 401);
  }

  const client = await loadClient(clientId);
  if (!client) return c.json({ error: 'invalid_token' }, 401);

  const member = await activeMemberByEmail(client.workspace_id, email);
  if (!member) {
    return c.json(
      { error: 'membership_inactive', message: 'Your membership is not active.' },
      403,
    );
  }

  // WP-OAuth shape (ID, user_login, user_nicename, user_email,
  // user_registered, user_status, display_name) + generic email/name so a
  // non-WordPress consumer of the same endpoints also works.
  return c.json({
    ID: member.personId,
    user_login: email,
    user_nicename: member.displayName,
    user_email: email,
    user_registered: member.createdAt,
    user_status: '0',
    display_name: member.displayName,
    email,
    name: member.displayName,
  });
});
