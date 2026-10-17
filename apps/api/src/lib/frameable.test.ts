// The one exception to "the API is never framed": in server.ts's order
// (exemption outside secureHeaders), a response that marks itself frameable
// AND names its framers loses X-Frame-Options; nothing else does.
import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { FRAMEABLE_HEADER, frameableExemption } from './frameable.js';

const app = new Hono();
app.use('*', frameableExemption);
app.use('*', secureHeaders({ xFrameOptions: 'DENY' }));
app.get('/plain', (c) => c.text('json-ish'));
app.get('/inline', (c) => c.body('pdf', 200, { [FRAMEABLE_HEADER]: '1', 'Content-Security-Policy': "default-src 'none'; frame-ancestors https://my.thethread.app" }));
app.get('/marked-no-ancestors', (c) => c.body('x', 200, { [FRAMEABLE_HEADER]: '1' }));

describe('framing', () => {
  it('every ordinary response stays DENY', async () => {
    expect((await app.request('/plain')).headers.get('x-frame-options')).toBe('DENY');
  });
  it('a marked response that names its framers loses DENY and the mark', async () => {
    const r = await app.request('/inline');
    expect(r.headers.get('x-frame-options')).toBeNull();
    expect(r.headers.get(FRAMEABLE_HEADER)).toBeNull();
    expect(r.headers.get('content-security-policy')).toContain('frame-ancestors https://my.thethread.app');
  });
  it('the mark alone, with no frame-ancestors, keeps DENY (never an open frame)', async () => {
    const r = await app.request('/marked-no-ancestors');
    expect(r.headers.get('x-frame-options')).toBe('DENY');
    expect(r.headers.get(FRAMEABLE_HEADER)).toBeNull();
  });
});
