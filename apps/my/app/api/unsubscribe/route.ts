// The email's "Stop these emails" — signed out, by token. Forwards to the
// API's public route, which is POST-only so a mail scanner fetching the link
// cannot unsubscribe anybody (the page needs a press).

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const res = await fetch(`${baseUrl}/api/v1/public/notify/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
    cache: 'no-store',
  });
  return new Response(await res.text(), { status: res.status, headers: { 'Content-Type': 'application/json' } });
}
