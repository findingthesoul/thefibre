// Public Fibre-API client — no JWT, no X-App-ID. Used by the public join
// page, the joined page and the embeds. Shape copied from Thread's
// lib/public-api.ts, pointed at the membership public routes.

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export class PublicApiError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
  }
}

export async function publicFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
  if (!res.ok) {
    let body: unknown;
    // Read the body ONCE as text, then try JSON — res.json() followed by
    // res.text() throws "Body is unusable" when the payload isn't JSON.
    const raw = await res.text().catch(() => '');
    try {
      body = JSON.parse(raw);
    } catch {
      body = raw;
    }
    throw new PublicApiError(res.status, `API ${res.status}: ${path}`, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// --- Public catalog shapes (GET /api/v1/membership/public/catalog/:slug) ---

/** Which terms a joiner must accept (2026-10-13). Optional: an older API
 *  does not send it, and the page then shows nothing to agree to rather than
 *  inventing a link. */
export type PublicTerms = { url: string; standard: boolean };

export type PublicTier = {
  id: string;
  name: string;
  description: string | null;
  characteristics: string[] | null;
  price_cents_year: number | null;
  price_cents_month: number | null;
  currency: string | null;
  sort_order: number | null;
  product_ids: string[];
  /** Tick-box add-ons at join time (2026-09-06) — optional until API ships. */
  optional_product_ids?: string[];
  /** The directory categories this tier confers, named (2026-10-13). The
   *  join form's consent checkbox says them out loud. Optional: an older API
   *  does not send it, and the form falls back to naming the community. */
  directory_categories?: string[];
  /** The launch-cohort rule: a date (YYYY-MM-DD) up to which this tier's
   *  first period runs, whatever the day somebody joins. When it is set, a
   *  yearly join pays the FULL year now and renews the day after — which the
   *  panel has to say before taking the money, not leave to the receipt.
   *  Optional: most tiers have no such date and renew a year after joining. */
  first_period_ends_on?: string | null;
  /** Not listed on the join page (2026-10-14). A tier reached by its direct
   *  link arrives with this true, so the page can say so — somebody opening
   *  an invitation should know they are looking at something not on offer to
   *  everybody. Optional: an older API does not send it. */
  hidden?: boolean;
  /** The pricing rule that will actually price THIS tier, which is what the
   *  join route uses. Optional: an older API sends only the workspace-wide
   *  one, and the panel falls back to that. */
  price_logic?: {
    rules?: { when: { attr: string; op: string; values: string[] }; pct: number }[];
    default_pct?: number;
  } | null;
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  characteristics: string[] | null;
  /** À-la-carte (2026-09-06) — optional until the API ships them. */
  price_cents?: number | null;
  price_interval?: string | null;
  currency?: string | null;
  purchasable?: boolean;
  links: { kind: string; ref: string; label?: string }[] | null;
  sort_order: number | null;
};

export type PublicCatalog = {
  /** Prices are excl. VAT and this community adds VAT (2026-10-15). */
  vat_registered?: boolean;
  /** The seller's home VAT rate, before the buyer's country is known. */
  vat_home_rate_pct?: number | null;
  price_logic?: {
    rules: { when: { attr: string; op: string; values: string[] }; pct: number; label?: string }[];
    default_pct: number;
  } | null;
  workspace: { slug: string; name: string };
  /** Workspace default page language (i18n P1) — optional until the API ships it. */
  locale?: string | null;
  tiers: PublicTier[];
  products: PublicProduct[];
  /** Which terms a joiner must accept — the workspace's own, or The Thread's
   *  standard ones (2026-10-13). Optional: an older API does not send it. */
  terms?: PublicTerms;
  join_page: { headline?: string; intro?: string } & Record<string, unknown>;
};

/** The catalogue, or ONE tier from it.
 *
 *  `tierId` is the direct link to an unlisted tier: the API then answers with
 *  exactly that tier, hidden or not, instead of the listed ones. It is the
 *  same endpoint on purpose — the shaping of a tier (its included and
 *  optional products, the categories it confers, the resolved terms) would
 *  otherwise exist twice, and the day the copies disagree is the day an
 *  invitation promises something the public page does not. */
export async function fetchCatalog(
  workspaceSlug: string,
  tierId?: string | null,
): Promise<PublicCatalog> {
  return publicFetch<PublicCatalog>(
    `/api/v1/membership/public/catalog/${encodeURIComponent(workspaceSlug)}${
      tierId ? `?tier=${encodeURIComponent(tierId)}` : ''
    }`,
  );
}
