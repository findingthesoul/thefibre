// The one exception to "the API is never framed" (server.ts).
//
// server.ts sends X-Frame-Options: DENY on every response — secureHeaders
// stamps it AFTER the route has run, so a route cannot take it off itself. A
// route that must be framed (an inline Drive file in my.thread's viewer, the
// only one) marks its response with FRAMEABLE_HEADER and states who may frame
// it in its own CSP `frame-ancestors`. This middleware, registered OUTSIDE
// secureHeaders, then drops the DENY and the mark on the way out.

import type { MiddlewareHandler } from 'hono';

export const FRAMEABLE_HEADER = 'X-Fibre-Frameable';

export const frameableExemption: MiddlewareHandler = async (c, next) => {
  await next();
  if (c.res.headers.get(FRAMEABLE_HEADER) !== '1') return;
  c.res.headers.delete(FRAMEABLE_HEADER);
  // Only when the response says who may frame it: never an open frame.
  if (/frame-ancestors /.test(c.res.headers.get('Content-Security-Policy') ?? '')) c.res.headers.delete('X-Frame-Options');
};
