// Vercel's project-domains API, the calls the domain package's second half
// needs (docs/domain-package.md, part 2): put a customer's host on the Vercel
// project that serves the app, read whether it is verified and whether its
// DNS points at us, take it off again.
//
// Same shape as lib/resend-domains.ts: fetch, no SDK, transport injectable so
// the mapping is unit-tested without a token. The token is the SERVER's
// (`VERCEL_API_TOKEN`, scoped to the team, on Fly); a workspace admin never
// sees it and never talks to Vercel.
//
// Projects are addressed by NAME, the way scripts/verify-vercel-env.mjs does:
// the platform is `thefibre`, every other app `thefibre-<dir>`. One project
// serves both stacks — production on `main`, staging as the `staging` branch
// (docs/environments.md) — so on staging a host is attached with
// `gitBranch: 'staging'`, or Vercel would serve production from it.
//
// What Vercel answers (docs/rest-api/projects):
//   POST   /v10/projects/{name}/domains {name, gitBranch?}
//          → {name, apexName, verified, verification: [{type, domain, value, reason}]}
//          `verified: false` with a TXT challenge means the apex is in use by
//          ANOTHER Vercel account and ownership must be proved first. 409 =
//          the host is already on another project.
//   GET    /v9/projects/{name}/domains/{host}   → the same shape, current
//   POST   /v9/projects/{name}/domains/{host}/verify
//   DELETE /v9/projects/{name}/domains/{host}
//   GET    /v6/domains/{host}/config → {misconfigured, configuredBy, …}
//          — whether the customer's CNAME actually points at Vercel. Read
//          defensively: the fields are many and not all documented.

export type VercelVerification = { type: string; domain: string; value: string; reason: string };

export type VercelProjectDomain = {
  name: string;
  apexName: string;
  projectId?: string;
  verified: boolean;
  verification?: VercelVerification[];
  gitBranch?: string | null;
};

export type VercelDomainConfig = {
  misconfigured: boolean;
  configuredBy?: string | null;
  recommendedCNAME?: string[] | undefined;
  recommendedIPv4?: string[] | undefined;
  /** The raw answer, kept so the settings page can show what Vercel said. */
  raw: Record<string, unknown>;
};

export class VercelDomainError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** The CNAME every customer host points at. Vercel also hands out a
 *  per-project target; this generic one is what their docs tell a customer
 *  to use and works for any project (docs/domains/working-with-domains). */
export const VERCEL_CNAME_TARGET = 'cname.vercel-dns.com';

type Fetch = typeof fetch;

export type VercelEnv = {
  VERCEL_API_TOKEN?: string | undefined;
  VERCEL_TEAM_ID?: string | undefined;
  FLY_APP_NAME?: string | undefined;
};

/** `staging` on the staging API, nothing (production) elsewhere — the same
 *  tell lib/cors-origins.ts reads. */
export function gitBranchFor(env: Pick<VercelEnv, 'FLY_APP_NAME'>): string | null {
  return env.FLY_APP_NAME === 'thefibre-api-staging' ? 'staging' : null;
}

/** Vercel project name for an app slug, the naming scripts/verify-vercel-env.mjs
 *  audits against. Only the apps with public pages a customer may host. */
export function vercelProjectFor(appSlug: string): string | null {
  switch (appSlug) {
    case 'fibre-meet':
      return 'thefibre-meet';
    case 'the-thread':
      return 'thefibre-thread';
    default:
      return null;
  }
}

export type VercelDomainsClient = {
  add(project: string, host: string): Promise<VercelProjectDomain>;
  get(project: string, host: string): Promise<VercelProjectDomain>;
  verify(project: string, host: string): Promise<VercelProjectDomain>;
  remove(project: string, host: string): Promise<void>;
  config(host: string): Promise<VercelDomainConfig>;
};

/** Null without a token — the routes answer 503, as they do for mail. */
export function vercelDomains(env: VercelEnv = process.env as VercelEnv, fetchImpl: Fetch = fetch): VercelDomainsClient | null {
  const token = env.VERCEL_API_TOKEN;
  if (!token) return null;
  const team = env.VERCEL_TEAM_ID ? `teamId=${encodeURIComponent(env.VERCEL_TEAM_ID)}` : '';
  const branch = gitBranchFor(env);
  const q = (path: string) => `https://api.vercel.com${path}${team ? (path.includes('?') ? '&' : '?') + team : ''}`;

  async function call<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const r = await fetchImpl(q(path), {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      let code = 'error';
      let message = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { error?: { code?: string; message?: string } };
        code = j.error?.code ?? code;
        message = j.error?.message ?? message;
      } catch {
        /* not JSON */
      }
      throw new VercelDomainError(r.status, code, message);
    }
    if (r.status === 204) return undefined as T;
    const text = await r.text();
    return (text ? JSON.parse(text) : {}) as T;
  }

  const enc = encodeURIComponent;
  return {
    add: (project, host) =>
      call<VercelProjectDomain>('POST', `/v10/projects/${enc(project)}/domains`, {
        name: host,
        ...(branch ? { gitBranch: branch } : {}),
      }),
    get: (project, host) => call<VercelProjectDomain>('GET', `/v9/projects/${enc(project)}/domains/${enc(host)}`),
    verify: (project, host) => call<VercelProjectDomain>('POST', `/v9/projects/${enc(project)}/domains/${enc(host)}/verify`),
    remove: async (project, host) => {
      await call<unknown>('DELETE', `/v9/projects/${enc(project)}/domains/${enc(host)}`);
    },
    config: async (host) => {
      const raw = await call<Record<string, unknown>>('GET', `/v6/domains/${enc(host)}/config`);
      const arr = (k: string) => (Array.isArray(raw[k]) ? (raw[k] as string[]) : undefined);
      return {
        misconfigured: raw.misconfigured === true,
        configuredBy: typeof raw.configuredBy === 'string' ? raw.configuredBy : null,
        recommendedCNAME: arr('recommendedCNAME'),
        recommendedIPv4: arr('recommendedIPv4'),
        raw,
      };
    },
  };
}

/**
 * Vercel's refusal, in words the workspace admin can act on. The two that
 * matter: 409 — the host is already on another Vercel project (ours or
 * somebody's); and a TXT challenge in `verification` — the apex belongs to
 * another Vercel account, which is not an error but a record to add. The
 * challenge is handled by the caller (it is a success with homework); this
 * maps the errors.
 */
export function plainVercelError(e: unknown): { status: 409 | 502 | 503; error: string } {
  if (e instanceof VercelDomainError) {
    if (e.status === 409) {
      return {
        status: 409,
        error:
          'This web address is already in use by another site on our hosting provider, so it cannot be added here. If it is yours elsewhere, remove it there first; otherwise write to us.',
      };
    }
    if (e.status === 429) return { status: 503, error: 'Our hosting provider is rate-limiting us. Try again in a minute.' };
    if (e.status === 400 && /not valid/i.test(e.message)) return { status: 502, error: `Our hosting provider refused the address: ${e.message}` };
    return { status: 502, error: `Our hosting provider refused: ${e.message}` };
  }
  return { status: 502, error: 'Our hosting provider did not answer.' };
}
