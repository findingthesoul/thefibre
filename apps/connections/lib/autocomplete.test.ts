// `#` and `@` suggestions while typing.
//
// The tests that matter most are the ones that stop it firing where it must
// not — an email address opening a people list would make the note box
// unusable — and the round trip: a picked suggestion has to be recognised by
// DETECTION as the exact thing that was picked, or the dropdown would insert
// words that silently never become tags.

import { describe, expect, it } from 'vitest';
import { activeToken, applySuggestion, suggest, tokenText } from './autocomplete';
import { detectMentions, detectTags } from './detect-tags';

const WORDS = [
  { id: 't1', name: 'facilitation' },
  { id: 't2', name: 'self-funded' },
  { id: 't3', name: 'deep democracy' },
  { id: 't4', name: 'EBBF', organisationId: 'o1' },
  { id: 't5', name: 'Zaailing Collectief', organisationId: 'o2' },
];
const PEOPLE = [
  { id: 'p1', name: 'Wilma Doornbos' },
  { id: 'p2', name: 'Fenna de Vries' },
];

describe('which word is being looked up', () => {
  it('finds a hash being typed at the caret', () => {
    const text = 'Talked about #fa';
    expect(activeToken(text, text.length)).toEqual({ trigger: '#', query: 'fa', start: 13, end: 16 });
  });

  it('finds an @ with nothing typed after it yet', () => {
    const text = 'Met @';
    expect(activeToken(text, text.length)).toMatchObject({ trigger: '@', query: '' });
  });

  it('does NOT open a list inside an email address', () => {
    const text = 'Mail jan@ebbf';
    expect(activeToken(text, text.length)).toBeNull();
  });

  it('does not treat editing the middle of an existing tag as a lookup', () => {
    const text = '#facilitation work';
    expect(activeToken(text, 4)).toBeNull();
  });

  it('ignores a token the caret has moved past', () => {
    const text = '#fa and more';
    expect(activeToken(text, text.length)).toBeNull();
  });

  it('accepts a marker right after an opening bracket', () => {
    const text = 'good session (#fa';
    expect(activeToken(text, text.length)).toMatchObject({ trigger: '#', query: 'fa' });
  });
});

describe('what is offered', () => {
  it('offers tags for # and never organisations or people', () => {
    const token = activeToken('#', 1)!;
    const names = suggest(token, WORDS, PEOPLE).map((s) => s.name);
    expect(names).toContain('facilitation');
    expect(names).not.toContain('EBBF');
    expect(names).not.toContain('Wilma Doornbos');
  });

  it('offers people and organisations for @, and never plain tags', () => {
    const token = activeToken('@', 1)!;
    const kinds = new Set(suggest(token, WORDS, PEOPLE).map((s) => s.kind));
    expect(kinds).toEqual(new Set(['person', 'organisation']));
  });

  it('puts a name that STARTS with the letters above one that merely contains a word starting with them', () => {
    const text = 'a #f';
    const names = suggest(activeToken(text, text.length)!, WORDS, PEOPLE).map((s) => s.name);
    expect(names[0]).toBe('facilitation');
    expect(names).toContain('self-funded');
    expect(names.indexOf('facilitation')).toBeLessThan(names.indexOf('self-funded'));
  });

  it('finds a person by their surname', () => {
    const text = '@doorn';
    const found = suggest(activeToken(text, text.length)!, WORDS, PEOPLE);
    expect(found.map((s) => s.name)).toEqual(['Wilma Doornbos']);
  });

  it('offers nothing when nothing matches, rather than everything', () => {
    const text = '#zzz';
    expect(suggest(activeToken(text, text.length)!, WORDS, PEOPLE)).toEqual([]);
  });
});

describe('what a pick writes, and whether detection then agrees', () => {
  it('replaces the typed fragment and leaves the caret after a space', () => {
    const text = 'Talked about #fa';
    const token = activeToken(text, text.length)!;
    const out = applySuggestion(text, token, { kind: 'tag', name: 'facilitation' });
    expect(out.text).toBe('Talked about #facilitation ');
    expect(out.caret).toBe(out.text.length);
  });

  it('keeps what came after the caret', () => {
    const text = 'About #de and more';
    const token = activeToken(text, 9)!;
    const out = applySuggestion(text, token, { kind: 'tag', name: 'deep democracy' });
    expect(out.text).toBe('About #deep-democracy and more');
  });

  it('a picked multi-word TAG is detected as that exact tag', () => {
    // The round trip. Without it the dropdown would insert a word that looks
    // right and quietly never becomes the tag somebody chose.
    const text = `Talked about ${tokenText('#', 'deep democracy')} today`;
    const tags = detectTags(text, WORDS);
    expect(tags.map((t) => t.name)).toContain('deep democracy');
  });

  it('a picked PERSON is detected as exactly that person', () => {
    const text = `Met ${tokenText('@', 'Wilma Doornbos')} today`;
    const mentions = detectMentions(text, PEOPLE, WORDS);
    expect(mentions).toEqual([expect.objectContaining({ kind: 'person', id: 'p1' })]);
  });

  it('a picked ORGANISATION is detected as that organisation', () => {
    const text = `Visited ${tokenText('@', 'Zaailing Collectief')} today`;
    const mentions = detectMentions(text, PEOPLE, WORDS);
    expect(mentions).toEqual([expect.objectContaining({ kind: 'organisation', id: 'o2' })]);
  });
});
