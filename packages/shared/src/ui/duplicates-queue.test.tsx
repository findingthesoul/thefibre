// @vitest-environment jsdom
//
// THE GAINS LINE HAS THREE STATES, AND THE THIRD IS SILENCE.
//
// A person pair carries `gains` — the columns that record would gain if kept.
// An organisation pair does not: organisation_duplicate_candidates returns no
// such columns. So the organisation screen passes NOTHING, and nothing must
// render as nothing.
//
// The failure this locks out already happened once. On staging, before the
// API carrying the preview was deployed, absent gains were rendered as an
// empty answer and BOTH records claimed to gain nothing — while one plainly
// had a phone and a city the other lacked (v1.149.x). The sentence was not
// merely useless, it was false, and it was false exactly where somebody was
// deciding which record to destroy.
//
// It became live again the moment these two screens were folded into one
// component (the DuplicatesQueue extraction): a single `gains={pair.aGains ??
// []}` anywhere in the shared code would reintroduce it for organisations,
// and no typechecker would notice, because [] is a perfectly good string[].
//
// Rendered for real with react-dom, the apps/connections pattern (createRoot
// + act, no testing-library).

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  DuplicatesQueue,
  type DuplicatePair,
  type DuplicatesStrings,
  type DuplicatesActions,
} from './duplicates-queue.js';

type Rec = { id: string; name: string };

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const GAINS_SENTENCE = 'Gains from the other:';
const GAINS_NOTHING = 'Gains nothing';

const STRINGS: DuplicatesStrings = {
  none: 'Nothing looks duplicated.',
  question: 'Same or different?',
  sameAnswer: 'The same one',
  differentAnswer: 'Two different ones',
  pickKeep: 'Which one do you keep?',
  keepThis: 'Merge into this one',
  back: 'Back',
  conflictIntro: 'These two say different things.',
  conflictKeeping: (name) => `Keeping: ${name}`,
  conflictOther: (name) => `From: ${name}`,
  conflictMerge: 'Merge with these answers',
  conflictUnavailable: (name) => `Could not compare, kept ${name}`,
  recentMerges: 'Recent merges',
  undo: 'Undo',
  droppedRows: 'could not be carried across:',
  gains: (fields) => `${GAINS_SENTENCE} ${fields}`,
  gainsNone: GAINS_NOTHING,
};

// Nothing here is called: the gains line renders before any action runs, and
// a stub that threw would make a failure look like a render bug.
const ACTIONS: DuplicatesActions = {
  fetchConflicts: async () => ({ conflicts: [] }),
  merge: async () => ({ ok: true }),
  undo: async () => ({ ok: true }),
  markDistinct: async () => ({ ok: true }),
  afterChange: () => {},
};

/** Render the queue with one pair and press the answer that reveals the cards'
 *  keep buttons — the gains line is shown beside the button it describes, so
 *  it does not exist until the pair has been called the same record. */
function renderQueue(pair: DuplicatePair<Rec>) {
  act(() => {
    root.render(
      <DuplicatesQueue<Rec>
        pairs={[pair]}
        merges={[]}
        strings={STRINGS}
        actions={ACTIONS}
        intlLocale="en-GB"
        labelFor={(c) => c.replace(/_/g, ' ')}
        reasonLabel={(r) => r}
        nameOf={(r) => r.name}
        hrefFor={(id) => `/x/${id}`}
        renderDetails={() => null}
        renderMeta={() => null}
        Link={({ href, className, children }) => (
          <a href={href} className={className}>
            {children}
          </a>
        )}
      />,
    );
  });
  // "The same one" → the keep buttons, and the gains line, appear.
  const same = [...container.querySelectorAll('button')].find(
    (b) => b.textContent === STRINGS.sameAnswer,
  );
  expect(same, 'the answer button should be on the page').toBeTruthy();
  act(() => {
    same!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  return container.textContent ?? '';
}

const PAIR = (over: Partial<DuplicatePair<Rec>>): DuplicatePair<Rec> => ({
  reason: 'same domain',
  a: { id: 'a', name: 'Alpha BV' },
  b: { id: 'b', name: 'Beta BV' },
  ...over,
});

describe('the gains line', () => {
  it('says nothing at all when nobody answered — the organisation case', () => {
    // No aGains, no bGains: exactly what apps/web's organisation screen
    // passes, because the candidates function has no such columns.
    const text = renderQueue(PAIR({}));

    // The cards ARE rendered — otherwise "no gains line" would be true of an
    // empty page and this test would pass against a component that renders
    // nothing at all.
    expect(text).toContain('Alpha BV');
    expect(text).toContain('Beta BV');
    expect(text).toContain(STRINGS.keepThis);

    expect(text).not.toContain(GAINS_SENTENCE);
    expect(text).not.toContain(GAINS_NOTHING);
  });

  it('says “gains nothing” when that is the real answer', () => {
    // An EMPTY answer is a finding, not an absence: it means the other record
    // is the fuller one. This is the assertion that stops the first test
    // being satisfied by a component that simply never renders gains.
    const text = renderQueue(PAIR({ aGains: [], bGains: ['phone'] }));
    expect(text).toContain(GAINS_NOTHING);
    expect(text).toContain(`${GAINS_SENTENCE} phone`);
  });

  it('lists the columns, de-duplicated and in words', () => {
    const text = renderQueue(
      PAIR({ aGains: ['address_line1', 'address_line2', 'phone'], bGains: undefined }),
    );
    // address_line1 and address_line2 both read "address"; naming it twice
    // looks like a mistake to the person reading it.
    expect(text).toContain(`${GAINS_SENTENCE} address line1, address line2, phone`);
  });

  it('distinguishes absent from empty on the SAME pair', () => {
    // The sharpest form: one side unknown, the other empty. If the component
    // coalesced them, both would read the same and this fails.
    const text = renderQueue(PAIR({ aGains: undefined, bGains: [] }));
    expect(text).toContain(GAINS_NOTHING);
    // Exactly one "gains nothing" — the absent side contributed none.
    expect(text.split(GAINS_NOTHING).length - 1).toBe(1);
  });
});
