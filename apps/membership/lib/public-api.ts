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
};

export type PublicProduct = {
  id: string;
  name: string;
  description: string | null;
  characteristics: string[] | null;
  links: { kind: string; ref: string; label?: string }[] | null;
  sort_order: number | null;
};

export type PublicCatalog = {
  workspace: { slug: string; name: string };
  tiers: PublicTier[];
  products: PublicProduct[];
  join_page: { headline?: string; intro?: string } & Record<string, unknown>;
};

export async function fetchCatalog(workspaceSlug: string): Promise<PublicCatalog> {
  return publicFetch<PublicCatalog>(
    `/api/v1/membership/public/catalog/${encodeURIComponent(workspaceSlug)}`,
  );
}
