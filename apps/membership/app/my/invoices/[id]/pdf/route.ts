// THE PDF TWIN IS GONE; THE ADDRESS IS NOT.
//
// This was a second copy of the invoice-PDF pass-through, pointed at the
// membership portal's own email-scoped endpoint. my.thread has the same route
// over the same data, and two of anything that hands somebody a document is
// one too many — the one being maintained is never the one in the old email.
//
// It redirects rather than 404s because the address is in sent receipts. The
// member signs in on my.thread and gets the file; the Members app no longer
// has an opinion about invoices.
//
// The pass-through itself (`createInvoicePdfRoute`) is untouched and still
// used by my.thread and by the admin side — nothing stored on Vercel, hard
// rule §13.

import { NextResponse } from 'next/server';
import { surfaceUrl } from '@thefibre/shared';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const host = new URL(request.url).host;
  const portal = surfaceUrl('my-portal', process.env, host);
  const { id } = await params;
  return NextResponse.redirect(`${portal}/invoices/${encodeURIComponent(id)}/pdf`, 302);
}
