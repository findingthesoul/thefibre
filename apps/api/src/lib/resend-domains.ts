// Resend's Domains API, the four calls the domain package needs.
//
// Thin fetch wrapper in the shape of lib/email/client.ts — no SDK — with
// the transport injectable so the mapping can be unit-tested without a key.
// Everything here runs with the SERVER's key; a workspace admin never sees it
// and never talks to Resend. The key is the same one mail goes out with, so
// a domain created here is verified for exactly the account that sends.
//
// What Resend answers with (docs/api-reference/domains):
//   POST /domains {name, region}      → the domain + its DNS `records`
//   GET  /domains/:id                 → the same, with current statuses
//   POST /domains/:id/verify          → starts an ASYNC check; the domain
//                                       reads `pending` until GET says more
//   DELETE /domains/:id
//   GET  /domains                     → {data: [...]} — the account's list
// Errors are {statusCode, name, message}; the one that matters here is 403
// validation_error "The example.com domain has been registered already" —
// which is what a domain already sitting in ANOTHER Resend team says. That
// is soul.com's state on 2026-10-06, so it gets a sentence of its own.

export type ResendRecordStatus = 'not_started' | 'pending' | 'verified' | 'failed' | 'temporary_failure';

export type ResendRecord = {
  /** 'SPF' | 'DKIM' | … — Resend's label for what the record is for. */
  record: string;
  /** The DNS name, relative to the domain in Resend's answer ("send", "resend._domainkey"). */
  name: string;
  type: string;
  value: string;
  ttl?: string;
  priority?: number;
  status: ResendRecordStatus;
};

export type ResendDomain = {
  id: string;
  name: string;
  status: ResendRecordStatus;
  region: string;
  records: ResendRecord[];
  created_at?: string;
};

export class ResendDomainError extends Error {
  constructor(
    public readonly status: number,
    public override readonly name: string,
    message: string,
  ) {
    super(message);
  }
}

/** The region every domain of ours lives in: Ireland, same as the platform's
 *  own senders and the one soul.com's half-added records already point at.
 *  A customer's domain in another region would bounce its mail through
 *  another continent for no reason. */
export const RESEND_REGION = 'eu-west-1';

type Fetch = typeof fetch;

export type ResendDomainsClient = {
  create(name: string): Promise<ResendDomain>;
  get(id: string): Promise<ResendDomain>;
  verify(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<Pick<ResendDomain, 'id' | 'name' | 'status' | 'region' | 'created_at'>[]>;
};

/** Null when no key is set — local dev and CI. The routes answer 503 then,
 *  the same way mail is a logged no-op without the key. */
export function resendDomains(
  key: string | undefined = process.env.RESEND_API_KEY,
  fetchImpl: Fetch = fetch,
): ResendDomainsClient | null {
  if (!key) return null;

  async function call<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
    const r = await fetchImpl(`https://api.resend.com${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!r.ok) {
      const text = await r.text().catch(() => '');
      let name = 'error';
      let message = text.slice(0, 300);
      try {
        const j = JSON.parse(text) as { name?: string; message?: string };
        name = j.name ?? name;
        message = j.message ?? message;
      } catch {
        /* not JSON — keep the text */
      }
      throw new ResendDomainError(r.status, name, message);
    }
    if (r.status === 204) return undefined as T;
    return (await r.json()) as T;
  }

  return {
    create: (name) => call<ResendDomain>('POST', '/domains', { name, region: RESEND_REGION }),
    get: (id) => call<ResendDomain>('GET', `/domains/${encodeURIComponent(id)}`),
    verify: async (id) => {
      await call<unknown>('POST', `/domains/${encodeURIComponent(id)}/verify`);
    },
    remove: async (id) => {
      await call<unknown>('DELETE', `/domains/${encodeURIComponent(id)}`);
    },
    list: async () => {
      const r = await call<{ data?: ResendDomain[] }>('GET', '/domains');
      return (r.data ?? []).map(({ id, name, status, region, created_at }) => ({
        id,
        name,
        status,
        region,
        ...(created_at ? { created_at } : {}),
      }));
    },
  };
}

/**
 * Resend's refusal, in words the workspace admin can act on. The 403
 * "registered already" means the domain sits in another Resend account —
 * ours or somebody's — and no DNS record they add will change that; it needs
 * us. Everything else is passed through, shortened.
 */
export function plainResendError(e: unknown): { status: 409 | 502 | 503; error: string } {
  if (e instanceof ResendDomainError) {
    if (e.status === 403 && /registered already|already exists/i.test(e.message)) {
      return {
        status: 409,
        error:
          'This domain is already registered with our mail provider under another account, so it cannot be added here. Write to us and we will move it — nothing you add in DNS can.',
      };
    }
    if (e.status === 429) return { status: 503, error: 'Our mail provider is rate-limiting us. Try again in a minute.' };
    return { status: 502, error: `Our mail provider refused: ${e.message}` };
  }
  return { status: 502, error: 'Our mail provider did not answer.' };
}
