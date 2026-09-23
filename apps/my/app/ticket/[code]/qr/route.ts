// GET /ticket/:code/qr.png — the same QR the door scans, from THIS origin.
//
// Sjoerd, 2026-09-23: "tickets may be kept on devices." That decision is what
// this route exists to make possible, and it is the smaller half of it.
//
// The image itself already exists, on the API: /thread/public/checkin/:code/
// qr.png. But a service worker must never cache a cross-origin response it
// cannot reason about — sw.js returns early for anything but same-origin GET,
// deliberately, because intercepting the API would be a second invisible
// network layer. Proxying the bytes through the portal makes the QR an
// ordinary same-origin asset the worker can hold, and leaves that rule alone.
//
// No session is needed and none is read: the check-in code IS the credential,
// the API's route is public for the same reason, and the door scanner reads it
// off a printed email. Adding auth here would make a ticket unusable in the one
// place it is for.

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  // The code shapes the upstream path, so it is checked rather than trusted.
  if (!/^[A-Za-z0-9-]{4,64}$/.test(code)) return new Response('Not found', { status: 404 });

  // An unreachable API must not become a 500. This route is reached from a
  // phone at a door and from the offline page's <img>; a server-error page in
  // either place is worse than a missing image, and the caller — the service
  // worker, or an <img> tag — treats any failure the same way. Found in
  // testing: with no API listening the bare fetch threw and Next answered 500.
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/api/v1/thread/public/checkin/${code}/qr.png`, {
      cache: 'no-store',
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
  if (!upstream.ok) return new Response('Not found', { status: 404 });

  return new Response(await upstream.arrayBuffer(), {
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'image/png',
      // A check-in code's QR never changes, so the copy a phone keeps can be
      // long-lived. `private` because it is one person's ticket and must not
      // sit in a shared cache on the way.
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  });
}
