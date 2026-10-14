import { describe, expect, it } from 'vitest';
import { membershipWelcome } from './membership-templates.js';

// ---------------------------------------------------------------------------
// "One welcome, two triggers" — the claim v1.186.0 made and only half kept.
//
// A member who joins and pays, and a member an admin adds by hand, get the
// same email. The template was unified in v1.186.0; the CONTENT was not — the
// hand-added path passed `renewsAt: null` and no calendars, so the same
// template still produced a thinner email for the person added by hand, which
// is exactly the drift that having two templates caused in the first place.
//
// So this asserts the invariant rather than the fix: given the same facts, the
// two triggers differ in ONE line, and that line is the invoice promise —
// because nobody was billed on the hand-added path, and promising an invoice
// that never arrives is worse than saying nothing.
// ---------------------------------------------------------------------------

const FACTS = {
  name: 'Marja',
  communityName: 'soul.com',
  tierName: 'Community member',
  renewsAt: '2027-10-14T05:03:20Z',
  tierDescription: 'Membership of the soul.com community.',
  characteristics: ['Meaningful conversations;', 'quarterly gatherings;'],
  calendarTeamNames: ['soul.com', 'Fellowship'],
  portalUrl: 'https://my.thethread.app/memberships',
  email: 'marja@example.com',
  locale: 'en',
} as const;

describe('one welcome, two triggers', () => {
  const paid = membershipWelcome({ ...FACTS });
  const byHand = membershipWelcome({ ...FACTS, invoiceFollows: false });

  it('differ in exactly one paragraph, and it is the invoice promise', () => {
    const lines = (html: string) => html.split('\n    ').map((l) => l.trim());
    const only = lines(paid.html).filter((l) => !lines(byHand.html).includes(l));
    expect(only).toHaveLength(1);
    expect(only[0]).toContain('invoice');
    // And nothing the hand-added one says is missing from the paid one: the
    // difference runs one way only.
    expect(lines(byHand.html).filter((l) => !lines(paid.html).includes(l))).toEqual([]);
  });

  it('both name the renewal date', () => {
    // The admin sets this date in the add-member dialog, so there is no
    // version of this email that honestly has nothing to say about it.
    for (const [which, msg] of [
      ['paid', paid],
      ['by hand', byHand],
    ] as const) {
      expect(msg.text, which).toContain('14 October 2027');
    }
  });

  it('the plain-text halves differ only in the invoice line too', () => {
    // The text part is what a reader on a plain-text client gets, and it has
    // been forgotten before — the HTML and the text are assembled separately.
    //
    // Blank runs are collapsed: dropping the invoice line leaves the blank
    // that separated it, so the two halves differ by one empty string as well
    // as by the sentence. That is nothing a reader can see, and asserting it
    // would make this test fail for the wrong reason the next time a line
    // moves.
    //
    // THE SENTENCE, not the word "invoice" — which also appears in the
    // portal's own list of what lives there ("Purchases — every invoice, to
    // download whenever you need it"), and that line is true on both paths.
    // A first draft of this test matched the word and failed for that reason;
    // keeping the lesson here because it is the same mistake as promising the
    // invoice itself.
    const PROMISE = 'Your invoice arrives in a separate email.';
    const strip = (t: string) =>
      t
        .split('\n')
        .filter((l) => l.trim() !== PROMISE)
        .filter((l, i, all) => l.trim() !== '' || all[i - 1]?.trim() !== '');
    expect(strip(paid.text)).toEqual(strip(byHand.text));
    expect(paid.text).toContain(PROMISE);
    expect(byHand.text).not.toContain(PROMISE);
  });
});

describe('a membership that opens more than one calendar', () => {
  // THE PRODUCTION SHAPE, not a hypothetical: soul.com's Fellowship product
  // grants two teams' calendars. The sentence is possessive ("{team}'s
  // calendar"), so joining the names would read as a mistake in English and
  // worse in the five machine-translated locales.
  const msg = membershipWelcome({ ...FACTS, calendarTeamNames: ['soul.com', 'Fellowship'] });

  it('says one sentence per calendar', () => {
    const sentences = msg.text.split('\n').filter((l) => l.includes('calendar.'));
    expect(sentences).toHaveLength(2);
    expect(sentences.join(' ')).toContain('soul.com');
    expect(sentences.join(' ')).toContain('Fellowship');
  });

  it('names no calendar when the membership opens none', () => {
    for (const none of [[], null, undefined, ['', '   ']]) {
      const quiet = membershipWelcome({ ...FACTS, calendarTeamNames: none });
      expect(quiet.text, JSON.stringify(none)).not.toContain('calendar.');
    }
  });
});
