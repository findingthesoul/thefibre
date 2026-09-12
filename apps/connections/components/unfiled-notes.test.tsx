import { describe, expect, it } from 'vitest';
import { candidatesFor } from './unfiled-notes';

const PEOPLE = [
  { id: '1', name: 'Wilma Doornbos' },
  { id: '2', name: 'Wilma de Vries' },
  { id: '3', name: 'Emma Wilson' },
  { id: '4', name: 'José Álvarez' },
];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('who a typed name might mean', () => {
  it('offers every person the name could be, never just the first', () => {
    // Two Wilmas is an ordinary community; the reader chooses.
    expect(ids(candidatesFor('Wilma', PEOPLE))).toEqual(['1', '2']);
  });

  it('narrows as more of the name is typed', () => {
    expect(ids(candidatesFor('wil doorn', PEOPLE))).toEqual(['1']);
  });

  it('matches the start of a word, not the middle', () => {
    // "ma" is inside Wilma and Emma; neither should come up.
    expect(candidatesFor('ma', PEOPLE)).toEqual([]);
  });

  it('ignores case and accents', () => {
    expect(ids(candidatesFor('jose alv', PEOPLE))).toEqual(['4']);
  });

  it('offers nobody for an empty name', () => {
    expect(candidatesFor('   ', PEOPLE)).toEqual([]);
  });
});
