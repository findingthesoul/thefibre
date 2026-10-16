// GET /api/geo — the country Vercel's edge thinks the viewer is in, for the
// join page's FIRST guess (Sjoerd, 2026-10-16: "recognize where people are
// from and preselect the country... they can refine it").
//
// A route of its own so the join page stays cached: reading request headers
// in the page would make every view dynamic. `private, no-store`, so no CDN
// ever hands one visitor's country to another. Nothing is stored, logged or
// sent on: the answer goes to this viewer's browser, which treats it as a
// default it shows and the viewer can change — the API never sees an IP or
// this guess, only the country the viewer kept at checkout.

export const dynamic = 'force-dynamic';

export function GET(req: Request) {
  const raw = req.headers.get('x-vercel-ip-country') ?? '';
  const country = /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : null;
  return Response.json({ country }, { headers: { 'Cache-Control': 'private, no-store' } });
}
