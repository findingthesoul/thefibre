// Where a Drive download may send the browser (2026-10-17, the coordinator's
// hardening of /files/drive/…/download). The API hands back an absolute
// one-minute address; this route only ever redirects to it — so it checks
// the address is the API's download stream and nothing else, and a
// misbehaving or compromised answer can never turn the route into an open
// redirect.
//
// Not a bare "starts with NEXT_PUBLIC_API_BASE_URL" check: the API builds the
// address from its PUBLIC host, which may differ from the host this app calls
// it on (the Fly hostname vs api.thethread.app). So: https, exactly the
// download path, and a host that is this app's API host or one of the API's
// known public hosts.

const KNOWN_API_HOSTS = new Set(['thefibre-api.fly.dev', 'thefibre-api-staging.fly.dev', 'api.thethread.app', 'api.thefibre.tech']);
const DOWNLOAD_PATH = '/api/v1/me/portal/drive-download';

export function safeDriveDownloadUrl(candidate: unknown, apiBase: string): string | null {
  if (typeof candidate !== 'string') return null;
  let u: URL;
  let base: URL;
  try {
    u = new URL(candidate);
    base = new URL(apiBase);
  } catch {
    return null;
  }
  const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) return null;
  if (u.username || u.password) return null;
  if (u.pathname !== DOWNLOAD_PATH) return null;
  if (u.hostname !== base.hostname && !KNOWN_API_HOSTS.has(u.hostname)) return null;
  return u.toString();
}
