# Spike: Circle SSO — The Fibre as an OAuth2 provider

*2026-09-05 · membership-proposal.md §3.6 phase 2 · SPIKE, not shipped product*

Circle.so's SSO settings paywall the **Custom OAuth2** option, but the named
presets — notably **"WordPress (WP-OAuth)"** — accept your own server URL +
client id/secret and speak plain OAuth2 underneath. This spike makes The
Fibre answer that contract, so a Circle community can use "Sign in with
your membership" where the *membership status is the gate*: an email
without an ACTIVE or GRACE `membership_member` in the workspace cannot get
in, and a lapsed membership stops working at the next sign-in.

## What was built

| Piece | Where |
| --- | --- |
| OAuth2 provider endpoints | `apps/api/src/routes/oauth-provider.ts` (mounted at `/api/v1/oauth`, auth bypassed in `middleware/app-context.ts` — endpoints carry their own auth) |
| `oauth_client` + `oauth_code` tables | `supabase/migrations/20260905220000_oauth_clients.sql` — RLS enabled, **no policies** (service-role only, the `membership_settings` precedent) |
| Sign-in leg | `apps/membership/app/oauth-continue/` — member sign-in (Google or email code), then hands the browser back to Circle |

**No admin surface** this spike — client rows are inserted by hand (SQL
below). No refresh tokens, no revocation endpoint, no scopes beyond a
static `basic`.

### The flow

1. Circle → `GET /api/v1/oauth/authorize?client_id&redirect_uri&response_type=code&state`.
   Client + redirect_uri validated against `oauth_client`; browser 302s to
   the membership app's `/oauth-continue` (the page is already whitelisted
   as a member route in membership's `/auth/callback` — session only, no
   workspace account needed).
2. `/oauth-continue` requires a Supabase sign-in, then calls
   `POST /api/v1/oauth/continue` server-side with the session Bearer. The
   API verifies the JWT against Supabase's JWKS (the
   `participantEmailFromAuth` pattern from `thread.ts`), resolves the email
   to a person in the client's workspace (primary or secondary email,
   citext so case-insensitive), and **requires an `active` or `grace`
   `membership_member`**. Pass → single-use code (32 random bytes,
   base64url, 60 s expiry) into `oauth_code`, and the page redirects to
   `redirect_uri?code=…&state=…`. Fail → 403, and the page shows "Your
   membership is not active."
3. Circle → `POST /api/v1/oauth/token` (form-encoded,
   `grant_type=authorization_code` + `code` + `client_id` +
   `client_secret`; secret compared as sha256, timing-safe; Basic auth and
   JSON bodies also accepted). Code must be unused + unexpired; it is
   claimed atomically (`used_at` conditional update, so a retried exchange
   loses). Response: `{ access_token, token_type: "Bearer", expires_in:
   900, scope: "basic" }`. The access token is a **stateless HS256 JWT**
   signed with the existing `SSO_INTERNAL_SECRET` (15 min,
   `{email, client_id}`, issuer `thefibre-oauth`) — no token table.
4. Circle → `GET /api/v1/oauth/me` with `?access_token=…` (WP-OAuth style)
   or `Authorization: Bearer` (both accepted, GET and POST). The token is
   verified and the membership is **re-checked live** — a member who lapsed
   inside the token's 15 minutes gets a 403 here too. Response is the
   WP-OAuth user shape ∪ generic claims:

   ```json
   {
     "ID": "<person uuid>",
     "user_login": "<email>",
     "user_nicename": "<display name>",
     "user_email": "<email>",
     "user_registered": "<person.created_at>",
     "user_status": "0",
     "display_name": "<display name>",
     "email": "<email>",
     "name": "<display name>"
   }
   ```

## What to paste into Circle (production values)

In Circle → Settings → Single Sign-On → provider **WordPress**:

| Circle field | Value |
| --- | --- |
| WordPress site / server URL | `https://thefibre-api.fly.dev/api/v1` |
| Client ID | the `client_id` you provisioned (below) |
| Client Secret | the secret you provisioned (below) |
| Callback / redirect URL | *copy from Circle*, then put it in the client row's `redirect_uris` |

The URL is `…/api/v1` (no trailing slash) because the working assumption is
that Circle appends the WP-OAuth paths to the server URL, i.e.
`{server}/oauth/authorize` → `https://thefibre-api.fly.dev/api/v1/oauth/authorize`.
If Circle instead asks for the three endpoint URLs separately, they are:

- Authorize: `https://thefibre-api.fly.dev/api/v1/oauth/authorize`
- Token: `https://thefibre-api.fly.dev/api/v1/oauth/token`
- User info: `https://thefibre-api.fly.dev/api/v1/oauth/me`

Staging equivalents: `https://thefibre-api-staging.fly.dev/api/v1/oauth/…`
(the continue page lives on membership's staging domain via
`MEMBERSHIP_APP_URL`).

## Provisioning a client by hand

Generate credentials locally (never store the secret anywhere but Circle):

```bash
node -e '
const { randomBytes, createHash } = require("node:crypto");
const clientId = "fibre_" + randomBytes(12).toString("hex");
const secret   = randomBytes(32).toString("base64url");
console.log("client_id:         ", clientId);
console.log("client_secret:     ", secret, "   <-- paste into Circle, then forget");
console.log("client_secret_hash:", createHash("sha256").update(secret, "utf8").digest("hex"));
'
```

Then insert the row (Supabase SQL editor, service role):

```sql
insert into public.oauth_client
  (workspace_id, name, client_id, client_secret_hash, redirect_uris)
values (
  '<workspace uuid>',
  'Circle — <community name>',
  '<client_id from above>',
  '<client_secret_hash from above>',
  array['<the exact callback URL Circle shows>']
);
```

`redirect_uris` is an exact-match allow-list — copy the callback URL from
Circle's SSO settings screen character-for-character.

## Verified vs assumed

**Verified** (wp-oauth.com docs — the plugin Circle's preset targets):

- Paths: `GET /oauth/authorize`, `POST /oauth/token`, `GET /oauth/me`
  (plus `/oauth/destroy`, not built — session teardown, not needed for
  sign-in).
- Authorize params: `client_id` (required), `redirect_uri`,
  `response_type=code` (required), `scope`, `state` — response returns
  `code` (+ `state` if supplied).
- Token request: POST body `grant_type=authorization_code`, `code`,
  `client_id`, `client_secret`, `redirect_uri` — i.e. `client_secret_post`.
- Token response shape: `{ access_token, expires_in, token_type: "Bearer",
  scope, refresh_token }`.
- `/oauth/me` takes `access_token` **as a query parameter** and returns
  `{ ID, user_login, user_nicename, user_email, user_registered,
  user_status, display_name }`.

**Assumed** (Circle's help center is JS-rendered and unfetchable; based on
Sjoerd's screenshots + third-party writeups of the WordPress preset):

- Circle's WordPress preset takes a single server URL and **appends** the
  `/oauth/…` paths (hence entering `…/api/v1`). If it wants full endpoint
  URLs instead, use the three URLs listed above — both work against this
  implementation.
- Circle sends the token request form-encoded with `client_secret_post`
  (we also accept Basic auth and JSON, so any of the three works).
- Circle keys the account on `user_email` and displays `display_name`, and
  does **not** need `refresh_token` for interactive sign-in. We do not
  issue one; if Circle hard-requires the field's presence, add a dummy or a
  real refresh grant (noted as a possible follow-up).
- Circle tolerates a string (uuid) `ID`; WordPress IDs are numeric strings.
  If Circle chokes, map to a stable numeric alias.

## Test plan — staging first, Circle last

**Do not enable SSO in Sjoerd's Circle community until every step below
passes.** A misconfigured SSO provider locks the community's front door for
every member (Circle replaces its own login with the provider).

1. Apply the migration on **staging**, deploy the staging API + membership
   app.
2. Provision a test client (SQL above) in the staging workspace with a
   temporary `redirect_uris` entry pointing at `https://example.com/cb`.
3. Walk the flow by hand with curl + a browser:
   - `GET …/oauth/authorize?client_id=…&redirect_uri=https://example.com/cb&response_type=code&state=xyz`
     → expect 302 to `/oauth-continue`, sign in as a **seeded active
     member's email**, land on `https://example.com/cb?code=…&state=xyz`.
   - Exchange the code:
     `curl -X POST …/oauth/token -d grant_type=authorization_code -d code=… -d client_id=… -d client_secret=… ` → expect the token JSON.
   - `curl "…/oauth/me?access_token=…"` → expect the WP user shape.
   - Re-exchange the same code → expect `invalid_grant` (single-use).
   - Sign in with an email that has **no** membership → expect the "Your
     membership is not active" page (the 403 is the feature).
   - Lapse the test member, call `/me` again with the still-valid token →
     expect 403.
4. In **Sjoerd's Circle** (real community): create the SSO config with the
   staging URLs but **leave SSO disabled / in test mode** if Circle offers
   one; Circle usually shows a "Test" button or a preview URL — use that
   first. Only after a full round-trip works, switch the config to the
   production URLs and enable.
5. Keep a Circle **admin session open in a second browser** while enabling,
   and know where Circle's "disable SSO" toggle is — that is the rollback.

## Caveats / follow-ups (deliberately out of spike scope)

- **Google sign-in return-trip**: the continue page sends Google users
  through `/auth/callback?next=/oauth-continue?…`. If the Supabase redirect
  allow-list only matches `…/auth/callback` exactly (no query wildcard),
  Google sign-in bounces to the default destination and drops the OAuth
  params; the email-code path is unaffected (client-side verify, direct
  return). Check the allow-list before the staging test; add
  `…/auth/callback*` if needed.
- `oauth_code` rows are never purged (60 s expiry is enforced on read, rows
  linger). A cleanup sweep or `pg_cron` delete is a one-liner later.
- Access tokens reuse `SSO_INTERNAL_SECRET` (already set on Fly for
  `/sso/resolve` and Meet). Fine for a spike; a dedicated
  `OAUTH_SIGNING_SECRET` would be cleaner if this ships.
- No consent screen ("Continue as <email> to Circle?") — the membership
  gate doubles as consent for the spike. Add one before a second client
  kind exists.
- Multiple Circle communities = multiple `oauth_client` rows; the admin
  surface (Settings → Apps or the membership app's settings) is the obvious
  next step if the spike sticks.
- Not run through `verify-external-app.mjs` — `/api/v1/oauth/*` is not part
  of the `/api/v1/apps/*` published contract, but once Circle points at it
  in production it is a de-facto contract of its own: treat it as
  additive-only from that day.
