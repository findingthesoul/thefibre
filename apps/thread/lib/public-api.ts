// Public Fibre-API client — no JWT, no X-App-ID. Used by the public thread
// pages, the enrol form, /my sign-in, certificates and embeds.

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
