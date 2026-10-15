import { describe, expect, it } from 'vitest';
import { tokensFor } from '@thefibre/shared/merge-tokens';
import { messageTokens, substituteTokens } from './message-tokens.js';
import { memberTagValues } from './member-page.js';
import { engagementMessage } from './email/thread-templates.js';

// THE two halves agree: each surface's filler fills exactly the tags the
// registry (@thefibre/shared/merge-tokens) offers on it — no chip that fills
// nothing, no filled value without a chip.
describe('every surface fills exactly the registry’s tags for it', () => {
  it('thread messages', () => {
    const v = messageTokens({ name: 'Marja de Vries', threadTitle: 't', organiserName: 'o', env: { NEXT_PUBLIC_MY_URL: 'https://my.example.test' } });
    expect(Object.keys(v).sort()).toEqual([...tokensFor('thread_message')].sort());
  });
  it('the member page', () => {
    const v = memberTagValues({ firstName: 'Marja', lastName: 'de Vries', email: null, community: 'c', tier: 't', nextEvent: 'n' });
    expect(Object.keys(v).sort()).toEqual([...tokensFor('member_page')].sort());
  });
});

describe('a <script> name is escaped on every surface', () => {
  it('thread message: filled as text, then the email escapes the whole body', () => {
    const v = messageTokens({ name: '<script>alert(1)</script>', firstName: '<script>alert(1)</script>', threadTitle: 't', organiserName: 'o' });
    const body = substituteTokens('Hi {first_name}', v);
    const msg = engagementMessage({ title: 'Welcome', bodyText: body, threadTitle: 't' });
    expect(msg.html).not.toContain('<script>');
    expect(msg.html).toContain('&lt;script&gt;');
  });
});

describe('the new message tags fill', () => {
  it('{facilitator} falls back to the organiser; {hosts} and {community} come through', () => {
    const base = { name: 'M', threadTitle: 't', organiserName: 'Sjoerd' };
    expect(substituteTokens('{facilitator}', messageTokens(base))).toBe('Sjoerd');
    expect(substituteTokens('{facilitator} · {hosts} · {community}', messageTokens({ ...base, facilitator: 'Anna', hosts: 'Anna and Peter', community: 'soul.com' }))).toBe(
      'Anna · Anna and Peter · soul.com',
    );
  });
});
