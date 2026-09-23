// @vitest-environment jsdom
//
// The detection both note boxes share, tested where it now lives.
//
// Written because the extraction that created this hook moved live behaviour
// out of a 1200-line component that no test rendered for tags: the person
// page's suite covers the offline save path and nothing else here. So the
// refactor was green and unproven, which is the state this repo keeps
// mistaking for safe.
//
// The X case is the sharp one. It is keyed by foldKey — lowercase with
// punctuation turned to spaces — and an earlier version of that filter used
// toLowerCase(). The two agree for "retreat" and differ for
// "Deep-Democracy", so the button looked right and did nothing for exactly
// the tags most likely to be real.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/(app)/people/[id]/actions', () => ({
  fetchVocabulary: vi.fn(async () => ({
    words: [{ name: 'retreat' }, { name: 'Deep-Democracy' }],
    people: [{ id: 'p1', name: 'Rense Bos' }],
  })),
}));

import { useNoteTags, type NoteTags } from './use-note-tags';

let container: HTMLDivElement;
let root: Root;
/** The hook's latest return, captured from a component that only exists to
 *  call it — the hook is the unit, not any particular box. */
let seen: NoteTags;

function Probe({ body }: { body: string }) {
  seen = useNoteTags(body);
  return null;
}

const settle = async () => {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
};

const render = async (body: string) => {
  await act(async () => {
    root.render(<Probe body={body} />);
  });
  await settle();
};

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('useNoteTags', () => {
  it('finds a tag the workspace already uses, and places it in the sentence', async () => {
    await render('we talked about #retreat plans');
    expect(seen.tags.map((t) => t.name)).toContain('retreat');
    // Non-empty is the assertion that matters: an empty ranges array renders
    // a box with no highlighting at all, which is exactly the bug being
    // fixed and is indistinguishable from "there were no tags".
    expect(seen.ranges.length).toBeGreaterThan(0);
  });

  it('finds an @person', async () => {
    await render('spoke with @Rense Bos today');
    expect(seen.peopleMentioned.map((m) => m.name)).toContain('Rense Bos');
  });

  it('the X keeps the word and drops the tag', async () => {
    await render('we talked about #retreat plans');
    expect(seen.tags).toHaveLength(1);

    await act(async () => {
      seen.unmake({ kind: 'tag', key: 'retreat' });
    });
    await settle();

    expect(seen.tags).toHaveLength(0);
    expect(seen.ranges).toHaveLength(0);
  });

  it('unmakes a punctuated tag — foldKey, not toLowerCase', async () => {
    // "Deep-Democracy" folds to "deep democracy". A filter using
    // toLowerCase() would look for "deep-democracy", never match, and leave
    // the tag standing while the button appeared to work.
    await render('the #Deep-Democracy session');
    expect(seen.tags.map((t) => t.name)).toContain('Deep-Democracy');

    await act(async () => {
      seen.unmake({ kind: 'tag', key: 'deep democracy' });
    });
    await settle();

    expect(seen.tags).toHaveLength(0);
  });

  it('a dropped tag stays dropped when the word is typed again', async () => {
    // Sjoerd, 2026-09-12: the X must be a decision, not a delay.
    await render('about #retreat');
    await act(async () => {
      seen.unmake({ kind: 'tag', key: 'retreat' });
    });
    await settle();
    await render('about #retreat and #retreat again');
    expect(seen.tags).toHaveLength(0);
  });

  it('is empty and harmless before the vocabulary arrives', async () => {
    // The fetch is deliberately silent on failure: no vocabulary means no
    // detection, and the box is the box it was before this feature.
    await act(async () => {
      root.render(<Probe body="about #retreat" />);
    });
    expect(seen.tags).toHaveLength(0);
    expect(seen.ranges).toHaveLength(0);
  });
});
