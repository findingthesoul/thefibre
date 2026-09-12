import { describe, expect, it } from 'vitest';
import { detectMentions, detectTags, highlightRanges, type KnownTag } from './detect-tags';

// The vocabulary a small workspace might actually have: two tags somebody
// made, and two organisations it holds.
const KNOWN: KnownTag[] = [
  { id: 't1', name: 'outreach' },
  { id: 't2', name: 'deep democracy' },
  { name: 'EBBF', organisationId: 'o1' },
  { id: 't3', name: 'Solidarity Lab', organisationId: 'o2' },
];

const names = (text: string) => detectTags(text, KNOWN).map((t) => t.name);

describe('hashes', () => {
  it('takes an explicit hash as a tag', () => {
    expect(names('good chat, #sdg13 came up again.')).toEqual(['sdg13']);
  });

  it('waits until the word is finished', () => {
    // Sjoerd's rule: a word becomes a tag once it is finished. Mid-typing,
    // "#sdg1" must not appear as a tag about to be created.
    expect(names('talked about #sdg1')).toEqual([]);
    expect(names('talked about #sdg13 ')).toEqual(['sdg13']);
  });

  it('keeps hash provenance even when the word is already a tag', () => {
    const [tag] = detectTags('all about #outreach today', KNOWN);
    expect(tag).toMatchObject({ id: 't1', name: 'outreach', via: 'hash' });
  });

  it('accepts non-ascii, because this product runs in six languages', () => {
    expect(names('ging over #opbouwwerk, goed gesprek')).toEqual(['opbouwwerk']);
  });

  it('does not report the same tag twice', () => {
    expect(names('#outreach and more #outreach ')).toEqual(['outreach']);
  });
});

describe('the workspace vocabulary', () => {
  it('finds a tag the workspace already uses', () => {
    expect(names('we agreed to do some outreach in March')).toEqual(['outreach']);
  });

  it('finds a multi-word tag across punctuation', () => {
    expect(names('she runs deep, democracy sessions')).toContain('deep democracy');
  });

  it('matches whole words only', () => {
    // "art" would fire on "participate" with a naive includes().
    expect(detectTags('everyone will participate', [{ id: 'x', name: 'art' }])).toEqual([]);
  });

  it('ignores case', () => {
    expect(names('Big Outreach push')).toEqual(['outreach']);
  });

  it('reports the tag as the workspace spells it, not as it was typed', () => {
    // The chip has to read like the vocabulary, otherwise two spellings of
    // one tag look like two tags.
    expect(names('big outreach push')[0]).toBe('outreach');
  });

  it('leaves very short vocabulary alone', () => {
    // "op" and "de" are ordinary Dutch words; one false positive on somebody's
    // record costs more than the missed match.
    expect(detectTags('op de fiets naar het gesprek', [{ id: 'x', name: 'op' }])).toEqual([]);
  });

  it('does not report a hashed word twice as a plain mention', () => {
    expect(names('#outreach was the theme, real outreach ')).toEqual(['outreach']);
  });
});

describe('organisations', () => {
  it('treats an organisation name as a tag', () => {
    const [tag] = detectTags('met her at the EBBF gathering', KNOWN);
    expect(tag).toMatchObject({ name: 'EBBF', organisationId: 'o1', via: 'organisation' });
  });

  it('carries no tag id when the tag does not exist yet', () => {
    // The organisation exists, the tag does not — it is created on commit.
    expect(detectTags('met her at the EBBF gathering', KNOWN)[0]?.id).toBeUndefined();
  });

  it('keeps an existing tag id when the organisation already has one', () => {
    const [tag] = detectTags('invoiced through Solidarity Lab last week', KNOWN);
    expect(tag).toMatchObject({ id: 't3', organisationId: 'o2', via: 'organisation' });
  });
});

describe('@ mentions', () => {
  const PEOPLE = [
    { id: 'p1', name: 'Wilma Doornbos' },
    { id: 'p2', name: 'Joost Veenstra' },
  ];
  const ORGS: KnownTag[] = [{ name: 'EBBF', organisationId: 'o1' }];
  const found = (text: string) => detectMentions(text, PEOPLE, ORGS);

  it('finds a person by first name', () => {
    expect(found('spoke with @wilma about it ')).toMatchObject([{ id: 'p1', kind: 'person' }]);
  });

  it('finds a person by surname', () => {
    expect(found('@doornbos was there ')).toMatchObject([{ id: 'p1' }]);
  });

  it('finds a person by the whole name without a space', () => {
    expect(found('@wilmadoornbos joined ')).toMatchObject([{ id: 'p1' }]);
  });

  it('finds an organisation', () => {
    expect(found('met them through @ebbf ')).toMatchObject([{ id: 'o1', kind: 'organisation' }]);
  });

  it('refuses an ambiguous fragment rather than guessing', () => {
    // Two people whose first names are the same. The cost of picking the
    // wrong one is a claim on the wrong person's record, which is the same
    // cost that keeps automatic name matching out of this module entirely.
    const two = [
      { id: 'a', name: 'Wilma Doornbos' },
      { id: 'b', name: 'Wilma Veenstra' },
    ];
    expect(detectMentions('@wilma said so ', two, [])).toEqual([]);
  });

  it('waits until the word is finished', () => {
    expect(found('spoke with @wilm')).toEqual([]);
  });

  it('finds nothing for an unknown name', () => {
    expect(found('@nobody was there ')).toEqual([]);
  });

  it('never picks up a bare name without the @', () => {
    // The whole reason people are allowed in this module at all: intent, not
    // inference. A name in prose stays invisible here.
    expect(found('Wilma Doornbos was there')).toEqual([]);
  });

  it('does not report the same mention twice', () => {
    expect(found('@wilma and later @wilma again ')).toHaveLength(1);
  });
});

describe('the two mechanisms stay apart', () => {
  it('detectTags never sees people', () => {
    // Belt and braces on the rule: even if somebody passes a person's name in
    // as a tag one day, detectTags has no concept of a person and this test
    // exists so the signature cannot quietly grow one.
    expect(detectTags('Wilma Doornbos came by', KNOWN)).toEqual([]);
  });
});

describe('where the tags sit in the sentence', () => {
  const PEOPLE = [{ id: 'p1', name: 'Wilma Doornbos' }];
  /** Detect exactly as the composer does, then mark. */
  const marked = (text: string) => {
    const ranges = highlightRanges(
      text,
      detectTags(text, KNOWN),
      detectMentions(text, PEOPLE, KNOWN),
    );
    return ranges.map((r) => text.slice(r.start, r.end));
  };

  it('marks a hashed tag including its #', () => {
    expect(marked('good chat about #sdg13 today')).toEqual(['#sdg13']);
  });

  it('marks a vocabulary word where it was actually typed', () => {
    expect(marked('some Outreach in March ')).toEqual(['Outreach']);
  });

  it('marks a two-word tag across the punctuation between its words', () => {
    expect(marked('she runs deep, democracy sessions')).toEqual(['deep, democracy']);
  });

  it('marks an organisation name', () => {
    expect(marked('met her at the EBBF gathering')).toEqual(['EBBF']);
  });

  it('marks an @mention including its @', () => {
    expect(marked('spoke with @wilma about it ')).toEqual(['@wilma']);
  });

  it('never marks a word inside another word', () => {
    const r = highlightRanges('everyone will participate', detectTags('everyone will participate', [{ id: 'x', name: 'art' }]), []);
    expect(r).toEqual([]);
  });

  it('marks every occurrence, not only the first', () => {
    expect(marked('outreach, then more outreach ')).toEqual(['outreach', 'outreach']);
  });

  it('marks nothing the chips would not also show', () => {
    // An unfinished hash is not detected, so it must not light up either —
    // the sentence and the chips can never disagree about the same word.
    expect(marked('talked about #sdg1')).toEqual([]);
  });

  it('lets the longer match win when two overlap', () => {
    const vocab = [
      { id: 'a', name: 'lab' },
      { id: 'b', name: 'Solidarity Lab', organisationId: 'o2' },
    ];
    const text = 'invoiced via Solidarity Lab ';
    const r = highlightRanges(text, detectTags(text, vocab), []);
    expect(r.map((x) => text.slice(x.start, x.end))).toEqual(['Solidarity Lab']);
  });
});

describe('quiet by default', () => {
  it('finds nothing in ordinary prose', () => {
    expect(names('Good conversation. She will think it over and come back to me.')).toEqual([]);
  });

  it('finds nothing in an empty note', () => {
    expect(names('')).toEqual([]);
  });
});
