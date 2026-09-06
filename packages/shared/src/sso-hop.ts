// Cross-apex SSO hop — silent session handoff between apps that live on
// different registrable domains (the thethread.app move: fibre web stays on
// thefibre.app, the delivery apps move to *.thethread.app, and no cookie can
// span both apexes).
//
// Flow: a cross-apex link points at the CURRENT app's /sso/hop?to=<slug>&
// next=<path>. Hop asks the API (POST /api/v1/sso/handoff, user's own Bearer
// token) for a single-use 60-second code, then 302s to the target app's
// /sso/land?code=…. Land redeems the code server-to-server (POST
// /api/v1/sso/redeem, X-SSO-Secret) for a Supabase magic-link token_hash,
// calls verifyOtp — minting a fresh, INDEPENDENT session on the target apex
// (never share one session's refresh-token family across apexes; Supabase
// rotation would kill it) — and continues through the app's normal
// /auth/callback so access-check + workspace claims run exactly as on a
// real sign-in. The Supabase credential never appears in a URL; only the
// opaque code does, inside one 302.
//
// Same-apex targets never hop: crossAppHref() emits the plain URL, so until
// the domains actually split, production behavior is byte-identical.
//
// No Next dependency (the auth-callback.ts arrangement): supabase client and
// redirect responses are injected; the request is read via the standard URL.

import { APPS, appUrl } from './branding.js';
import type { AppId } from './index.js';

// --- apex comparison -------------------------------------------------------

/** Best-effort registrable domain: the last two labels of the hostname.
 *  localhost (any port — ports don't scope cookies) and bare IPs count as
 *  one shared apex so local dev never hops. Known blind spot: two
 *  *.vercel.app previews look same-apex here although the Public Suffix
 *  List keeps their cookies apart — a preview visitor just sees the target's
 *  sign-in page, which is fine for previews. */
function apexOf(u: string): string {
  let host: string;
  try {
    host = new URL(u).hostname;
  } catch {
    return u;
  }
  if (host === 'localhost' || host.endsWith('.localhost')) return 'localhost';
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;
  const labels = host.split('.');
  return labels.slice(-2).join('.');
}

export function isCrossApex(a: string, b: string): boolean {
  return apexOf(a) !== apexOf(b);
}

/** Href for a link from `current` app to `target` app. Same apex → the plain
 *  absolute URL (cookie already travels). Different apex → a relative
 *  /sso/hop path on the CURRENT app, which carries the session across.
 *  Always use this (or appUrl for same-app links) — never a hand-written
 *  domain string; hand-written domain lists are a recurring bug class. */
export function crossAppHref(
  current: AppId,
  target: AppId,
  env?: Record<string, string | undefined>,
  next?: string,
): string {
  const to = appUrl(target, env);
  if (!isCrossApex(appUrl(current, env), to)) {
    return next ? new URL(next, to).toString() : to;
  }
  const q = new URLSearchParams({ to: target });
  if (next) q.set('next', next);
  return `/sso/hop?${q.toString()}`;
}

// --- pref carry ------------------------------------------------------------

// The .thefibre.app-scoped preference cookies don't exist on the other apex;
// the hop carries these (validated — the values also end up in Set-Cookie
// headers, so the allowlist doubles as header-injection protection).
const PREF_CARRY: ReadonlyArray<{ name: string; ok: (v: string) => boolean }> = [
  { name: 'thefibre.theme', ok: (v) => ['light', 'dark', 'system'].includes(v) },
  { name: 'thefibre.sidebar', ok: (v) => ['expanded', 'collapsed', 'hover'].includes(v) },
  { name: 'thefibre.locale', ok: (v) => /^[a-z]{2}(-[A-Za-z]{2})?$/.test(v) },
];

function collectPrefs(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const jar = new Map<string, string>();
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) jar.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
  }
  const out: Record<string, string> = {};
  for (const { name, ok } of PREF_CARRY) {
    const v = jar.get(name);
    if (v !== undefined && ok(decodeURIComponent(v))) out[name] = decodeURIComponent(v);
  }
  return Object.keys(out).length ? JSON.stringify(out) : null;
}

function applyPrefs(
  res: Response,
  prefsParam: string | null,
  cookieDomain: string | undefined,
  secure: boolean,
): void {
  if (!prefsParam) return;
  let parsed: unknown;
  try {
    parsed = JSON.parse(prefsParam);
  } catch {
    return;
  }
  if (typeof parsed !== 'object' || parsed === null) return;
  const oneYear = 60 * 60 * 24 * 365;
  for (const { name, ok } of PREF_CARRY) {
    const v = (parsed as Record<string, unknown>)[name];
    if (typeof v !== 'string' || !ok(v)) continue;
    res.headers.append(
      'Set-Cookie',
      `${name}=${encodeURIComponent(v)}; Path=/; Max-Age=${oneYear}; SameSite=Lax` +
        (cookieDomain ? `; Domain=${cookieDomain}` : '') +
        (secure ? '; Secure' : ''),
    );
  }
}

// --- injected-supabase structural types ------------------------------------

type SupabaseHopish = {
  auth: {
    getSession: () => Promise<{ data: { session: { access_token: string } | null } }>;
  };
};

type SupabaseLandish = {
  auth: {
    verifyOtp: (params: {
      type: 'magiclink' | 'email';
      token_hash: string;
    }) => Promise<{ error: { message: string } | null }>;
  };
};

// --- /sso/hop --------------------------------------------------------------

export function createSsoHop({
  getSupabase,
  redirect,
  env = {},
  currentApp,
}: {
  getSupabase: () => Promise<SupabaseHopish>;
  redirect: (url: URL | string) => Response;
  /** Pass process.env — the package reads no globals (the appUrl pattern). */
  env?: Record<string, string | undefined>;
  currentApp: AppId;
}) {
  return async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const to = url.searchParams.get('to') as AppId | null;
    const rawNext = url.searchParams.get('next') ?? '/dashboard';
    // No open redirect: target paths only ('//host' is scheme-relative).
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';

    const meta = to ? APPS[to] : undefined;
    if (!to || !meta || !meta.available) {
      return redirect(new URL('/', url.origin));
    }
    const target = appUrl(to, env);

    // Same apex → the cookie already travels; nothing to hand off.
    if (!isCrossApex(appUrl(currentApp, env), target)) {
      return redirect(new URL(next, target));
    }

    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) {
      // Not signed in here — the target shows its own sign-in. No error surface.
      return redirect(new URL(next, target));
    }

    const apiBase = env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
    let code: string | null = null;
    try {
      const r = await fetch(`${apiBase}/api/v1/sso/handoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ target_app: to }),
        cache: 'no-store',
      });
      if (r.ok) code = ((await r.json()) as { code?: string }).code ?? null;
    } catch {
      // Fall through — degrade to a plain link.
    }
    if (!code) return redirect(new URL(next, target));

    const land = new URL('/sso/land', target);
    land.searchParams.set('code', code);
    land.searchParams.set('next', next);
    const prefs = collectPrefs(req.headers.get('cookie'));
    if (prefs) land.searchParams.set('prefs', prefs);
    return redirect(land);
  };
}

// --- /sso/land -------------------------------------------------------------

export function createSsoLand({
  getSupabase,
  redirect,
  env = {},
  currentApp,
}: {
  getSupabase: () => Promise<SupabaseLandish>;
  redirect: (url: URL | string) => Response;
  env?: Record<string, string | undefined>;
  currentApp: AppId;
}) {
  return async function GET(req: Request): Promise<Response> {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const rawNext = url.searchParams.get('next') ?? '/dashboard';
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard';
    // Expired/replayed/failed → the app's own sign-in page; one click recovers.
    const fallback = () => redirect(new URL(`/?next=${encodeURIComponent(next)}`, url.origin));

    const ssoSecret = env.SSO_INTERNAL_SECRET;
    if (!code || !ssoSecret) return fallback();

    const apiBase = env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';
    let tokenHash: string | null = null;
    try {
      const r = await fetch(`${apiBase}/api/v1/sso/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-SSO-Secret': ssoSecret },
        body: JSON.stringify({ code, app: currentApp }),
        cache: 'no-store',
      });
      if (r.ok) tokenHash = ((await r.json()) as { token_hash?: string }).token_hash ?? null;
    } catch {
      // Fall through.
    }
    if (!tokenHash) return fallback();

    const supabase = await getSupabase();
    // supabase-js accepts either name for a generateLink('magiclink') hash
    // depending on version; try the specific one first.
    let { error } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash });
    if (error) {
      ({ error } = await supabase.auth.verifyOtp({ type: 'email', token_hash: tokenHash }));
    }
    if (error) return fallback();

    // Continue through the app's own callback (no code param → its
    // "session already exists" branch) so access-check, /no-access routing
    // and the workspace-claim refresh run exactly as on a real sign-in.
    const res = redirect(new URL(`/auth/callback?next=${encodeURIComponent(next)}`, url.origin));
    applyPrefs(
      res,
      url.searchParams.get('prefs'),
      env.NEXT_PUBLIC_COOKIE_DOMAIN,
      url.protocol === 'https:',
    );
    return res;
  };
}
