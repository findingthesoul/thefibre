import { describe, expect, it } from 'vitest';
import { detectTags, type KnownTag } from './detect-tags';

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

describe('quiet by default', () => {
  it('finds nothing in ordinary prose', () => {
    expect(names('Good conversation. She will think it over and come back to me.')).toEqual([]);
  });

  it('finds nothing in an empty note', () => {
    expect(names('')).toEqual([]);
  });
});
