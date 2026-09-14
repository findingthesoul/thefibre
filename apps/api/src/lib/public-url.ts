// The API's own public base URL — the ONE place it is derived.
//
// PUBLIC_API_URL is the address the outside world reaches this API on
// (see .env.example). It feeds every URL the API hands to a third party
// that must round-trip back to us: OAuth redirect URIs registered with
// Google and Zoom (which must match their consoles byte for byte), and the
// QR / wallet-pass image links embedded in Thread emails. The fallback is
// the Fly hostname the API has always answered on; the api.thefibre.app
// CNAME is still unshipped, so that fallback is what production actually
// uses today.
//
// Until 2026-09-14 this expression lived in three files (google/client.ts,
// zoom/client.ts, routes/thread.ts) — and one of them had read a differently
// spelled variable for months, so its env override was dead. One definition
// means one variable name to get wrong.

export function publicApiUrl(): string {
  return process.env.PUBLIC_API_URL ?? 'https://thefibre-api.fly.dev';
}
