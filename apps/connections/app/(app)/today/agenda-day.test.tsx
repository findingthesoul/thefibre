// @vitest-environment jsdom
//
// The geometry of the day grid, rendered for real.
//
// lib/day-grid.ts is tested on its own and says where a meeting belongs in
// MINUTES. This is the other half: that the component turns those minutes
// into the right pixels. An inverted formula, an hour height applied twice or
// a lane width off by one column are all silent — everything still renders,
// and only an eye on the page would notice. This is the eye.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Everything the blocks open or link to is somebody else's test.
vi.mock('./meeting-note', () => ({ MeetingWriteUp: () => null }));
vi.mock('./agenda-add', () => ({ AddAttendee: () => null }));

import { AgendaDay } from './agenda-day';
import type { AgendaEvent } from './agenda';

/** An event on TODAY, given local wall-clock times. */
const ev = (id: string, from: string, to: string, over: Partial<AgendaEvent> = {}): AgendaEvent => {
  const at = (hhmm: string) => {
    const d = new Date();
    d.setHours(Number(hhmm.slice(0, 2)), Number(hhmm.slice(3)), 0, 0);
    return d.toISOString();
  };
  return {
    id,
    summary: id,
    start: at(from),
    end: at(to),
    all_day: false,
    location: null,
    conference_url: null,
    people: [],
    known: 0,
    ...over,
  };
};

const HOUR = 52; // must match agenda-day.tsx
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

const render = (events: AgendaEvent[]) =>
  act(() => {
    root.render(<AgendaDay events={events} locale="en" intl="en-GB" />);
  });

/** The positioned block whose label is `id`. */
const block = (id: string) =>
  [...container.querySelectorAll('button')].find((b) => b.textContent?.startsWith(id)) as
    | HTMLButtonElement
    | undefined;

describe('a meeting is drawn over the time it takes', () => {
  it('starts at its hour and is as tall as it is long', () => {
    render([ev('a', '09:00', '10:30')]);
    const b = block('a')!;
    // The grid opens at 07:00, so 09:00 is two hours down.
    expect(b.style.top).toBe(`${2 * HOUR}px`);
    // An hour and a half tall, less the 2px that keeps blocks apart.
    expect(b.style.height).toBe(`${1.5 * HOUR - 2}px`);
  });

  it('is full width when nothing clashes with it', () => {
    render([ev('a', '09:00', '10:00'), ev('b', '11:00', '12:00')]);
    for (const id of ['a', 'b']) {
      expect(block(id)!.style.left).toBe('0%');
      expect(block(id)!.style.width).toContain('100%');
    }
  });

  it('splits the width when two overlap, and puts the second on the right', () => {
    render([ev('a', '09:00', '10:30'), ev('b', '10:00', '11:00')]);
    expect(block('a')!.style.left).toBe('0%');
    expect(block('b')!.style.left).toBe('50%');
    expect(block('b')!.style.width).toContain('50%');
  });

  it('never draws a meeting too short to read', () => {
    render([ev('a', '09:00', '09:05')]);
    // Half an hour's worth, not five minutes' worth.
    expect(Number.parseFloat(block('a')!.style.height)).toBeGreaterThanOrEqual(HOUR / 2 - 2);
  });

  it('opens the grid early enough to hold an early meeting', () => {
    render([ev('a', '06:00', '07:00')]);
    // 06:00 is now the top of the grid, so the block sits at zero.
    expect(block('a')!.style.top).toBe('0px');
  });
});

describe('a block is visible against the page', () => {
  // The page's ground in Connect is `surface-sunken` (a cool slate, set in
  // globals.css). A block painted the same colour disappears — which a past
  // block did until Sjoerd said so on 2026-09-22. This is the rule, not the
  // shade: whatever the palette does, a block must not be the ground.
  it('is never painted the page’s own background', () => {
    render([ev('past', '01:00', '02:00'), ev('later', '23:00', '23:30')]);
    for (const id of ['past', 'later']) {
      expect(block(id)!.className).toContain('bg-surface-raised');
      expect(block(id)!.className).not.toContain('bg-surface-sunken');
    }
  });

  it('keeps an edge of its own', () => {
    render([ev('a', '09:00', '10:00')]);
    expect(block('a')!.className).toContain('border-line');
  });
});

describe('an all-day entry', () => {
  it('is a chip above the grid, not a block on it', () => {
    render([ev('a', '00:00', '23:59', { all_day: true })]);
    const b = block('a')!;
    expect(b.style.top).toBe('');
    expect(b.className).toContain('rounded-full');
  });
});
