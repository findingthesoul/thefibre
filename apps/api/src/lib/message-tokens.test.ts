import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { MY_THREAD_TOKEN, messageTokens, myThreadUrl, substituteTokens } from './message-tokens.js';
import { engagementMessage } from './email/thread-templates.js';

const ENV = { NEXT_PUBLIC_MY_URL: 'https://my.example.test' };

describe('the tokens an organiser can type', () => {
  const tokens = messageTokens({
    name: 'Marja de Vries',
    threadTitle: 'Vertrouwen als de basis',
    organiserName: 'soul.com community',
    startsOn: '2026-11-03',
    env: ENV,
  });

  it('{name} is the first name, because a message says hi to a person', () => {
    expect(tokens['{name}']).toBe('Marja');
  });

  it('{start_date} and {date} are the same value under two names', () => {
    expect(tokens['{start_date}']).toBe(tokens['{date}']);
    expect(tokens['{date}']).toBe('3 November 2026');
  });

  it('{my.thread} is the portal address', () => {
    expect(tokens[MY_THREAD_TOKEN]).toBe('https://my.example.test');
  });

  it('leaves a token it does not know alone rather than blanking it', () => {
    expect(substituteTokens('see {not_a_token} here', tokens)).toBe('see {not_a_token} here');
  });

  it('substitutes every occurrence, not just the first', () => {
    expect(substituteTokens(`${MY_THREAD_TOKEN} and ${MY_THREAD_TOKEN}`, tokens)).toBe(
      'https://my.example.test and https://my.example.test',
    );
  });

  it('falls back to the whole name when there is no space to split on', () => {
    expect(messageTokens({ name: 'marja@example.com', threadTitle: 't', organiserName: 'o', env: ENV })['{name}']).toBe(
      'marja@example.com',
    );
  });

  it('leaves the date EMPTY rather than printing "Invalid Date" when a thread has no start', () => {
    const t = messageTokens({ name: 'M', threadTitle: 't', organiserName: 'o', env: ENV });
    expect(t['{date}']).toBe('');
    expect(t['{start_date}']).toBe('');
  });
});

describe('the portal address becomes a link in the HTML part', () => {
  const url = myThreadUrl();
  const body = `Everything you are part of lives at ${url} — have a look.`;
  const msg = engagementMessage({ title: 'Welcome', bodyText: body, threadTitle: 'A thread' });

  it('is an anchor pointing at the portal', () => {
    expect(msg.html).toContain(`<a href="${url}"`);
  });

  it('shows the address without the scheme, so both parts read the same', () => {
    expect(msg.html).toContain(`>${url.replace(/^https?:\/\//, '')}</a>`);
  });

  it('the plain-text part keeps the full URL, which is what makes it usable there', () => {
    expect(msg.text).toContain(url);
    expect(msg.text).not.toContain('<a ');
  });

  it('still escapes everything else the organiser wrote', () => {
    const hostile = engagementMessage({
      title: 'x',
      bodyText: '<script>alert(1)</script> <b>bold</b>',
      threadTitle: 'A thread',
    });
    expect(hostile.html).not.toContain('<script>');
    expect(hostile.html).not.toContain('<b>');
    expect(hostile.html).toContain('&lt;script&gt;');
  });

  it('an organiser cannot forge their own anchor by typing one', () => {
    const forged = engagementMessage({
      title: 'x',
      bodyText: '<a href="https://evil.test">click</a>',
      threadTitle: 'A thread',
    });
    expect(forged.html).not.toContain('href="https://evil.test"');
  });
});

// The two send paths have drifted before: the scheduler's hand-written copy
// of the token map was missing {start_date}, so the token that exists FOR
// date-relative messages failed on the path that sends them. Triggered sends
// fire immediately, so testing a new token by hand exercises the copy that
// works and never the copy that does not — which is how the gap survived.
//
// This reads the source because what needs asserting is an absence: that
// neither path has grown a second map. No amount of calling the functions
// proves a future one has not been added beside them.
describe('both send paths use the one token map', () => {
  const source = readFileSync(fileURLToPath(new URL('../routes/thread.ts', import.meta.url)), 'utf8');

  it('nobody has re-declared a local token map', () => {
    expect(source).not.toMatch(/'\{organiser\}':/);
    expect(source).not.toMatch(/'\{start_date\}'\s*\]?\s*=/);
  });

  it('the triggered path and the scheduler both call messageTokens', () => {
    expect(source.match(/messageTokens\(/g)?.length).toBe(2);
  });
});
