// GET /calendar/<token>.ics — the subscribable calendar, as a calendar client
// fetches it.
//
// WHY THIS ADDRESS AND NOT THE API'S. A subscription URL lives in somebody's
// calendar for years; changing it means asking every person to re-add it in
// every client they use. The API is still answering on `thefibre-api.fly.dev`
// with its own CNAME unshipped, so publishing that host as a permanent
// address would be handing out a URL we already know we want to move. The
// portal's domain is the one the person recognises and the one that is not
// going anywhere.
//
// So this is a pipe, and nothing else. No session, no lookup, no decision:
// the token is the credential and the API is where it means something. This
// app holds no personal data (hard rule 1) and this route does not change
// that — it never parses the body it forwards.

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Refuse anything that is not shaped like one of our tokens before making
  // a request at all — 64 hex characters, with the .ics the clients that
  // sniff extensions want. Cheap, and it keeps probing traffic off the API.
  const bare = token.replace(/\.ics$/i, '');
  if (!/^[0-9a-f]{64}$/.test(bare)) {
    return new Response('Not found', { status: 404 });
  }

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/v1/me/calendar/${bare}`, { cache: 'no-store' });
  } catch {
    // The API is unreachable. A calendar client retries on its own schedule;
    // what matters is that it does not read a 500 as "this feed is gone".
    return new Response('Calendar unavailable', { status: 503 });
  }

  if (!res.ok) return new Response('Not found', { status: res.status === 404 ? 404 : 502 });

  return new Response(await res.text(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="my-sessions.ics"',
      'Cache-Control': 'no-store, max-age=0',
      // A subscription address is a credential in a URL. Keep it out of
      // referrers and out of search, belt and braces over robots.ts.
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
