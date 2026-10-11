// What actually reaches Resend.
//
// test-marking.test.ts proves the HELPERS behave. This proves the WIRING: that
// sendEmail applies them on staging and does not on production. The gap
// between the two is real — a regression that called markSubject
// unconditionally inside sendEmail would pass every case in that file and put
// "[STAGING]" on a customer's receipt.
//
// So this captures the request body sent to Resend and compares it, field by
// field, against the message that went in.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendEmail, type EmailMessage } from './client.js';

const MSG: EmailMessage = {
  to: 'someone@example.com',
  subject: 'Your ticket for Working with conflict',
  text: 'You are enrolled.',
  html: '<html lang="en">\n<body style="margin: 0;">\n<p>You are enrolled.</p>\n</body></html>',
};

let sent: Record<string, unknown>[] = [];
const ORIGINAL = { ...process.env };

beforeEach(() => {
  sent = [];
  process.env.RESEND_API_KEY = 'test-key-not-a-real-one';
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, init: { body: string }) => {
      sent.push(JSON.parse(init.body) as Record<string, unknown>);
      return { ok: true, status: 200, text: async () => '' } as unknown as Response;
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL };
});

describe('what sendEmail hands to Resend', () => {
  // THE case this whole feature is judged on.
  it('on PRODUCTION, every field is exactly what the template produced', async () => {
    process.env.FLY_APP_NAME = 'thefibre-api';
    await sendEmail(MSG);

    expect(sent).toHaveLength(1);
    expect(sent[0]!.subject).toBe(MSG.subject);
    expect(sent[0]!.html).toBe(MSG.html);
    expect(sent[0]!.text).toBe(MSG.text);
    // Said twice on purpose: not merely "no prefix", but the identical string.
    expect(String(sent[0]!.subject)).not.toContain('STAGING');
    expect(String(sent[0]!.html)).not.toContain('data-test-banner');
  });

  it('off Fly entirely, also untouched', async () => {
    delete process.env.FLY_APP_NAME;
    await sendEmail(MSG);
    expect(sent[0]!.subject).toBe(MSG.subject);
    expect(sent[0]!.html).toBe(MSG.html);
    expect(sent[0]!.text).toBe(MSG.text);
  });

  it('on STAGING, all three parts are marked', async () => {
    process.env.FLY_APP_NAME = 'thefibre-api-staging';
    await sendEmail(MSG);

    expect(sent[0]!.subject).toBe(`[STAGING] ${MSG.subject}`);
    expect(String(sent[0]!.html)).toContain('data-test-banner');
    expect(String(sent[0]!.html)).toContain('not a real transaction');
    expect(String(sent[0]!.text)).toContain('not a real transaction');
    // And the real message is still all there underneath the label.
    expect(String(sent[0]!.html)).toContain('<p>You are enrolled.</p>');
    expect(String(sent[0]!.text)).toContain('You are enrolled.');
  });

  // The log line is the only way to answer "is staging marking its mail?"
  // from outside, so it is worth an assertion — including that it carries
  // NEITHER the subject NOR the recipient.
  it('says so in the log on staging, without the subject or the recipient', async () => {
    process.env.FLY_APP_NAME = 'thefibre-api-staging';
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      lines.push(a.map(String).join(' '));
    });
    await sendEmail(MSG);
    spy.mockRestore();

    const marked = lines.filter((l) => l.includes('marked as a staging test'));
    expect(marked).toHaveLength(1);
    expect(marked[0]).not.toContain(MSG.subject);
    expect(marked[0]).not.toContain(MSG.to);
  });

  it('says nothing on production', async () => {
    process.env.FLY_APP_NAME = 'thefibre-api';
    const lines: string[] = [];
    const spy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
      lines.push(a.map(String).join(' '));
    });
    await sendEmail(MSG);
    spy.mockRestore();
    expect(lines.filter((l) => l.includes('marked as a staging test'))).toHaveLength(0);
  });

  // The marking must not disturb anything else about the envelope.
  it('leaves the sender, recipient and attachments alone on staging', async () => {
    process.env.FLY_APP_NAME = 'thefibre-api-staging';
    await sendEmail({
      ...MSG,
      replyTo: 'organiser@example.com',
      attachments: [{ filename: 'invoice.pdf', content: 'AAAA' }],
    });

    expect(sent[0]!.to).toBe(MSG.to);
    expect(sent[0]!.reply_to).toBe('organiser@example.com');
    expect(sent[0]!.attachments).toEqual([{ filename: 'invoice.pdf', content: 'AAAA' }]);
  });

  // The sender-rejected retry posts a SECOND time. Both posts must carry the
  // same marking, or a fallback send would arrive unmarked from staging.
  it('marks the retry too when the sender address is refused', async () => {
    process.env.FLY_APP_NAME = 'thefibre-api-staging';
    let call = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(JSON.parse(init.body) as Record<string, unknown>);
        call += 1;
        return call === 1
          ? ({ ok: false, status: 403, text: async () => 'domain not verified' } as unknown as Response)
          : ({ ok: true, status: 200, text: async () => '' } as unknown as Response);
      }),
    );

    await sendEmail({ ...MSG, fromAddress: 'hello@unverified.example' });

    expect(sent).toHaveLength(2);
    for (const body of sent) {
      expect(body.subject).toBe(`[STAGING] ${MSG.subject}`);
      expect(String(body.html)).toContain('data-test-banner');
    }
  });
});
