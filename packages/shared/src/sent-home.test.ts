import { describe, it, expect } from 'vitest';
import { sentHomeUrl, readSentHome, type SentHomeReason } from './sent-home.js';

// The union and the runtime guard in readSentHome are two separate lists of
// the same thing, and nothing made them agree: a reason added to the type was
// still refused at the door, so the app would redirect and The Fibre would
// show nothing. Caught in review of 'organiser-elsewhere' — the union, the
// guard and the popup copy are three places, and the first version of that
// change updated one.
//
// `Record<SentHomeReason, true>` is the forcing function: adding a member to
// the union makes THIS OBJECT fail to typecheck until it is listed here, and
// the test below then makes the guard accept it.
const EVERY_REASON: Record<SentHomeReason, true> = {
  'no-access': true,
  'no-session': true,
  'organiser-elsewhere': true,
};

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
    expect(back).toEqual({ reason: 'no-access', from: 'fibre-meet', workspace: 'The Thread', chosen: false });
  });

  it('is null for an ordinary visit', () => {
    expect(readSentHome({})).toBeNull();
  });

  // The parameters arrive from another apex and are therefore attacker-shaped
  // input, not trusted state. An unknown reason must not reach the popup.
  it('refuses a reason it does not know', () => {
    expect(readSentHome({ sent_home: 'something-else', from: 'the-thread' })).toBeNull();
  });

  it('accepts every reason the type allows', () => {
    for (const reason of Object.keys(EVERY_REASON) as SentHomeReason[]) {
      const back = readSentHome({ sent_home: reason, from: 'the-thread' });
      expect(back, `readSentHome refuses '${reason}', which the type allows`).toEqual({
        reason,
        from: 'the-thread',
        workspace: null,
        chosen: false,
      });
    }
  });

  it('round-trips the organiser-elsewhere reason', () => {
    const url = new URL(
      sentHomeUrl({ reason: 'organiser-elsewhere', from: 'the-thread', workspace: 'soul.com' }, ENV),
    );
    expect(readSentHome(Object.fromEntries(url.searchParams))).toEqual({
      reason: 'organiser-elsewhere',
      from: 'the-thread',
      workspace: 'soul.com',
      chosen: false,
    });
  });

  it('refuses a reason with no app', () => {
    expect(readSentHome({ sent_home: 'no-access' })).toBeNull();
  });

  it('takes the first value when a parameter is repeated', () => {
    expect(readSentHome({ sent_home: ['no-access', 'no-session'], from: ['the-thread'] })).toEqual({
      reason: 'no-access',
      from: 'the-thread',
      workspace: null,
      chosen: false,
    });
  });

  // "They chose this workspace" travels as its own flag, because it changes
  // both the sentence and what is offered — a way back, rather than an
  // apology about a workspace.
  it('carries the chosen flag, and omits it when not chosen', () => {
    const chosen = new URL(
      sentHomeUrl({ reason: 'no-access', from: 'the-thread', workspace: 'soul.com', chosen: true }, ENV),
    );
    expect(chosen.searchParams.get('chose')).toBe('1');
    const not = new URL(
      sentHomeUrl({ reason: 'no-access', from: 'the-thread', workspace: 'soul.com' }, ENV),
    );
    expect(not.searchParams.has('chose')).toBe(false);
  });

  it('round-trips chosen', () => {
    const url = new URL(
      sentHomeUrl({ reason: 'no-access', from: 'the-thread', workspace: 'soul.com', chosen: true }, ENV),
    );
    expect(readSentHome(Object.fromEntries(url.searchParams))).toEqual({
      reason: 'no-access',
      from: 'the-thread',
      workspace: 'soul.com',
      chosen: true,
    });
  });

  // These parameters cross an apex and anybody can edit them. Only the exact
  // '1' this package writes counts — anything else falls back to the plainer
  // copy, which is the safe direction to be wrong in.
  it('treats any other chose value as not chosen', () => {
    for (const v of ['true', 'yes', '0', '', '1 ', '01']) {
      const back = readSentHome({ sent_home: 'no-access', from: 'the-thread', chose: v });
      expect(back?.chosen, `chose=${JSON.stringify(v)} must not read as chosen`).toBe(false);
    }
  });

});
