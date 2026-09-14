// Browser-side asset upload: multipart straight to the Fibre API, because a
// server action serialises FormData poorly for binaries. Returns the public
// URL of the stored file.
//
// ONE implementation (2026-09-14). Thread, Meet and web each carried a copy
// that differed only in the endpoint and the X-App-ID — Meet's said so in
// its own header ("Mirrors apps/thread/lib/upload.ts"). Each app now binds
// this once with what only it knows: which upload route, which app, and how
// its browser client reads the session. No framework import here.

export function createAssetUploader({
  appId,
  path,
  baseUrl,
  getAccessToken,
}: {
  /** The slug announced in X-App-ID. */
  appId: string;
  /** The upload route, e.g. '/api/v1/uploads' or '/api/v1/thread/uploads'. */
  path: string;
  /** Defaults to the local API; pass NEXT_PUBLIC_API_BASE_URL from the app. */
  baseUrl?: string;
  /** The browser session's JWT, or nothing when signed out. */
  getAccessToken: () => Promise<string | null | undefined>;
}): (file: File) => Promise<string> {
  const base = (baseUrl ?? 'http://localhost:8080').replace(/\/$/, '');
  return async function uploadAsset(file: File): Promise<string> {
    const token = await getAccessToken();
    if (!token) throw new Error('not signed in');
    const fd = new FormData();
    fd.set('file', file);
    const res = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'X-App-ID': appId },
      body: fd,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`upload failed (${res.status}): ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { url: string };
    return json.url;
  };
}
