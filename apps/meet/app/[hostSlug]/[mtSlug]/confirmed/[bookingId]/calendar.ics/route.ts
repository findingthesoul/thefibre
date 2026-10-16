// "Add to calendar" — proxies the .ics the API renders for this booking.
//
// The file is built in ONE place (apps/api/src/lib/ical.ts, which the
// confirmation emails link to as well); this route only puts it on the app's
// own domain so the download doesn't bounce the invitee to an API hostname.

import { NextResponse } from 'next/server';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const { bookingId } = await params;
  // `for=host` asks for the host's copy of the file, whose title names the
  // invitee instead of the host. Forwarded verbatim rather than rebuilt, and
  // nothing else in the query string is passed on.
  const q = new URL(req.url).searchParams;
  const forHost = q.get('for') === 'host';
  // The manage token: the file names the guest, so the API only serves it to
  // a holder of the booking's token (security fix, 2026-10-16).
  const token = q.get('t');
  const upstreamQuery = new URLSearchParams();
  if (forHost) upstreamQuery.set('for', 'host');
  if (token) upstreamQuery.set('t', token);
  const upstream = await fetch(
    `${baseUrl}/api/v1/meet/public/bookings/${encodeURIComponent(bookingId)}/calendar.ics${
      upstreamQuery.size ? `?${upstreamQuery}` : ''
    }`,
    { cache: 'no-store' },
  );
  if (!upstream.ok) {
    return NextResponse.json({ error: 'booking not found' }, { status: upstream.status });
  }
  return new NextResponse(await upstream.text(), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="meeting-${bookingId.slice(0, 8)}.ics"`,
      'Cache-Control': 'no-store',
    },
  });
}
