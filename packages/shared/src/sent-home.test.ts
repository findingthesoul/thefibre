import { describe, it, expect } from 'vitest';
import { sentHomeUrl, readSentHome } from './sent-home.js';

const ENV = { NEXT_PUBLIC_FIBRE_URL: 'https://thefibre.tech' };

describe('sentHomeUrl', () => {
  it('points at The Fibre for the environment it is running in', () => {
    const url = sentHomeUrl({ reason: 'no-access', from: 'fibre-models' }, ENV);
    // The staging trap this package exists to close: without env it would
    // send a staging user to production.
    expect(url.startsWith('https://thefibre.tech/dashboard?')).toBe(true);
  });

  it('carries the app and the workspace name', () => {
    const url = new URL(sentHomeUrl({ reason: 'no-access', from: 'fibre-models', workspace: 'soul.com' }, ENV));
    expect(url.searchParams.get('sent_home')).toBe('no-access');
    expect(url.searchParams.get('from')).toBe('fibre-models');
    expect(url.searchParams.get('in')).toBe('soul.com');
  });

  it('omits the workspace when there is none rather than sending empty', () => {
    const url = new URL(sentHomeUrl({ reason: 'no-session', from: 'the-thread', workspace: null }, ENV));
    expect(url.searchParams.has('in')).toBe(false);
  });

  it('escapes a workspace name that would otherwise break the query', () => {
    const url = new URL(sentHomeUrl({ reason: 'no-access', from: 'the-thread', workspace: 'A&B = C' }, ENV));
    expect(url.searchParams.get('in')).toBe('A&B = C');
  });
});

describe('readSentHome', () => {
  it('round-trips what sentHomeUrl wrote', () => {
    const url = new URL(sentHomeUrl({ reason: 'no-access', from: 'fibre-meet', workspace: 'The Thread' }, ENV));
    const back = readSentHome(Object.fromEntries(url.searchParams));
    expect(back).toEqual({ reason: 'no-access', from: 'fibre-meet', workspace: 'The Thread' });
  });

  it('is null for an ordinary visit', () => {
    expect(readSentHome({})).toBeNull();
  });

  // The parameters arrive from another apex and are therefore attacker-shaped
  // input, not trusted state. An unknown reason must not reach the popup.
  it('refuses a reason it does not know', () => {
    expect(readSentHome({ sent_home: 'something-else', from: 'the-thread' })).toBeNull();
  });

  it('refuses a reason with no app', () => {
    expect(readSentHome({ sent_home: 'no-access' })).toBeNull();
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(readSentHome({ sent_home: ['no-access', 'no-session'], from: ['the-thread'] })).toEqual({
      reason: 'no-access',
      from: 'the-thread',
      workspace: null,
    });
  });
});
