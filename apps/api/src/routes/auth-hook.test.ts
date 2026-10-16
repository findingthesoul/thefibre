// The auth email HOOK end to end, in process (2026-10-16): a signed Supabase
// payload in, the email handed to the sender out. For a sign-in
// (magiclink/signup) the email carries the CODE and NO /auth/v1/verify URL,
// in HTML or text — a scanner GET on that URL consumed the token and every
// typed code failed. An invite still carries its link. The database reads
// (brand, locale) and the sender are faked; the signature is real.

import { createHmac, randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const sent: { to: string; html: string; text: string }[] = [];
vi.mock('../lib/email/client.js', () => ({ sendEmail: async (m: { to: string; html: string; text: string }) => void sent.push(m) }));
vi.mock('../lib/email/platform-i18n.js', () => ({ platformEmailLocale: async () => 'en' }));
vi.mock('../lib/workspace-brand.js', () => ({ getWorkspaceBrand: async () => null }));
vi.mock('../db.js', () => {
  const chain: Record<string, unknown> = {};
  for (const k of ['select', 'ilike', 'eq', 'is', 'in', 'order', 'limit']) chain[k] = () => chain;
  chain.maybeSingle = async () => ({ data: null, error: null });
  chain.then = (res: (v: unknown) => void) => res({ data: [], error: null });
  return { adminClient: { from: () => chain } };
});

const SECRET = randomBytes(32).toString('base64');
process.env.SUPABASE_AUTH_HOOK_SECRET = `v1,whsec_${SECRET}`;
const { authHookRoutes } = await import('./auth-hook.js');

async function post(action: string) {
  const body = JSON.stringify({
    user: { email: 'member@example.org' },
    email_data: {
      token: '87654321',
      token_hash: 'pkce_hash_that_a_scanner_would_consume',
      redirect_to: 'https://my.thethread.app/auth/callback',
      email_action_type: action,
      site_url: 'https://abc.supabase.co/auth/v1',
    },
  });
  const id = `msg_${randomBytes(6).toString('hex')}`;
  const ts = String(Math.floor(Date.now() / 1000));
  const sig = createHmac('sha256', Buffer.from(SECRET, 'base64')).update(`${id}.${ts}.${body}`).digest('base64');
  return authHookRoutes.request('/email', { method: 'POST', body, headers: { 'webhook-id': id, 'webhook-timestamp': ts, 'webhook-signature': `v1,${sig}`, 'content-type': 'application/json' } });
}

beforeEach(() => {
  sent.length = 0;
});

describe('auth hook → email', () => {
  for (const action of ['magiclink', 'signup']) {
    it(`${action}: the code, and no verify URL anywhere in the email`, async () => {
      const r = await post(action);
      expect(r.status, await r.clone().text()).toBe(200);
      expect(sent).toHaveLength(1);
      const { html, text } = sent[0]!;
      for (const part of [html, text]) {
        expect(part).not.toContain('/auth/v1/verify');
        expect(part).not.toContain('pkce_hash_that_a_scanner_would_consume');
      }
      expect(html).toContain('87654321');
    });
  }

  it('an invite keeps its link', async () => {
    const r = await post('invite');
    expect(r.status).toBe(200);
    expect(sent[0]!.html).toContain('/auth/v1/verify');
  });

  it('a bad signature is refused and nothing is sent', async () => {
    const r = await authHookRoutes.request('/email', { method: 'POST', body: '{}', headers: { 'webhook-id': 'x', 'webhook-timestamp': '1', 'webhook-signature': 'v1,AAAA' } });
    expect(r.status).toBe(401);
    expect(sent).toHaveLength(0);
  });
});
