import { describe, expect, it } from 'vitest';
import { applyFilters, filterOptions, parseFilters, type FilterableItem } from './embed-filters';

// Pinned clock: 15 June 2026 (month boundaries are the rule under test).
const NOW = new Date('2026-06-15T12:00:00Z');
const item = (over: Partial<FilterableItem> & { id: string }) => ({
  starts_on: null as string | null,
  ends_on: null as string | null,
  team: null as FilterableItem['team'],
  categories: [] as FilterableItem['categories'],
  language: 'en',
  ...over,
});
const past = item({ id: 'past', starts_on: '2026-05-01', ends_on: '2026-05-02' });
const running = item({ id: 'running', starts_on: '2026-06-01', ends_on: '2026-06-30', team: { slug: 'choir', name: 'Choir' } });
const nextMonth = item({ id: 'next', starts_on: '2026-07-04', categories: [{ slug: 'yoga', name: 'Yoga' }], language: 'nl' });
const undated = item({ id: 'undated', team: { slug: 'band', name: 'Band' } });
const all = [past, running, nextMonth, undated];
const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe('visitor filters', () => {
  it('parses data-filters into the canonical order, dropping unknowns', () => {
    expect(parseFilters('language, nonsense,date')).toEqual(['date', 'language']);
    expect(parseFilters(undefined)).toEqual([]);
  });
  it('upcoming keeps anything not yet ended (and undated); past is the rest', () => {
    expect(ids(applyFilters(all, { date: 'upcoming' }, NOW))).toEqual(['running', 'next', 'undated']);
    expect(ids(applyFilters(all, { date: 'past' }, NOW))).toEqual(['past']);
  });
  it('this month / next month by start date, across a month boundary', () => {
    expect(ids(applyFilters(all, { date: 'this_month' }, NOW))).toEqual(['running']);
    expect(ids(applyFilters(all, { date: 'next_month' }, NOW))).toEqual(['next']);
    // December → January rolls the year.
    expect(ids(applyFilters([item({ id: 'jan', starts_on: '2027-01-05' })], { date: 'next_month' }, new Date('2026-12-20T09:00:00Z')))).toEqual(['jan']);
  });
  it('team, category and language narrow, and combine', () => {
    expect(ids(applyFilters(all, { team: 'choir' }, NOW))).toEqual(['running']);
    expect(ids(applyFilters(all, { category: 'yoga' }, NOW))).toEqual(['next']);
    expect(ids(applyFilters(all, { language: 'nl', date: 'upcoming' }, NOW))).toEqual(['next']);
  });
  it('offers only values present, and nothing for a single value', () => {
    const o = filterOptions(all);
    expect(o.team.map((t) => t.value)).toEqual(['band', 'choir']);
    expect(o.category).toEqual([]); // only one category in the list
    expect(o.language).toEqual(['en', 'nl']);
  });
});

describe('event dates, when the thread has key moments', () => {
  const now = new Date('2027-03-10T12:00:00Z');
  const base = { team: null, categories: [], language: 'en' };
  it('decide upcoming / past over the preparation period', () => {
    // Prepared since January, the event itself was in February: past.
    const past = { ...base, starts_on: '2027-01-01', ends_on: '2027-06-30', event_starts_at: '2027-02-01T10:00:00Z', event_ends_at: '2027-02-02T16:00:00Z' };
    expect(applyFilters([past], { date: 'past' }, now)).toHaveLength(1);
    expect(applyFilters([past], { date: 'upcoming' }, now)).toHaveLength(0);
  });
  it('decide the month', () => {
    const april = { ...base, starts_on: '2027-01-01', ends_on: null, event_starts_at: '2027-04-12T10:00:00Z', event_ends_at: null };
    expect(applyFilters([april], { date: 'next_month' }, now)).toHaveLength(1);
    expect(applyFilters([april], { date: 'this_month' }, now)).toHaveLength(0);
  });
});
