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
  const forHost = new URL(req.url).searchParams.get('for') === 'host';
  const upstream = await fetch(
    `${baseUrl}/api/v1/meet/public/bookings/${encodeURIComponent(bookingId)}/calendar.ics${
      forHost ? '?for=host' : ''
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
