// @vitest-environment jsdom
//
// public/offline.html against lib/offline-notes.ts.
//
// The two share no code — the offline page cannot import anything, because it
// has to run when nothing but the service worker's cache is reachable — so the
// storage format is a contract between two files that could drift apart
// silently. These tests run the REAL page, not a copy of its logic: load the
// HTML, let its script execute, use the form, then read the result back with
// the app's own queue.

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearOfflineData,
  queuedNotes,
  queueNote,
  setCurrentWorkspace,
} from './offline-notes';

const HTML = fs.readFileSync(path.resolve(__dirname, '../public/offline.html'), 'utf8');

/** Render the offline page into this document and run its inline script. */
function openOfflinePage() {
  const doc = new DOMParser().parseFromString(HTML, 'text/html');
  document.head.innerHTML = doc.head.innerHTML;
  document.body.innerHTML = doc.body.innerHTML;
  const code = doc.querySelector('script')!.textContent!;
  // eslint-disable-next-line no-new-func
  new Function(code)();
}

beforeEach(() => {
  localStorage.clear();
  setCurrentWorkspace('ws1');
});
afterEach(() => localStorage.clear());

/** Type into a field the way a person does, so the page's listeners run. */
function type(id: string, value: string) {
  const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement;
  el.value = value;
  el.dispatchEvent(new Event('input'));
}
const submit = () =>
  (document.getElementById('form') as HTMLFormElement).dispatchEvent(
    new Event('submit', { cancelable: true }),
  );

describe('the offline page writes what the app reads', () => {
  it('a note written on the offline page is picked up by the app queue, with the typed name', () => {
    openOfflinePage();
    type('who', 'Wilma Doornbos');
    type('body', 'Spoke in the corridor about the retreat.');
    submit();

    const q = queuedNotes('ws1');
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({
      person_name: 'Wilma Doornbos',
      body: 'Spoke in the corridor about the retreat.',
      kind: 'note',
      is_draft: false,
    });
    // No person is chosen offline; the app asks back online.
    expect(q[0]).not.toHaveProperty('person_id');
    // A committed note needs these to pass PUT /notes validation.
    expect(q[0]!.client_ref).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof q[0]!.happened_at).toBe('string');
  });

  it('stamps the note with the workspace it was written in', () => {
    openOfflinePage();
    type('who', 'Wilma');
    type('body', 'about the retreat');
    submit();
    expect(queuedNotes('ws1')).toHaveLength(1);
    expect(queuedNotes('ws2')).toHaveLength(0);
  });

  it('keeps nothing without a name', () => {
    openOfflinePage();
    type('body', 'about the retreat');
    submit();
    expect(queuedNotes('ws1')).toHaveLength(0);
    expect((document.getElementById('save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('offers no list of people, even on a device that still has one', () => {
    // The list older versions kept must not come back through this page.
    localStorage.setItem('connections:people', JSON.stringify({ workspaceId: 'ws1', people: [{ id: 'x', name: 'Wilma' }] }));
    openOfflinePage();
    expect(document.body.textContent).not.toContain('Wilma');
    expect(document.querySelectorAll('#people, #people button')).toHaveLength(0);
  });

  it('does not promise to keep a note when the device refuses to store one', () => {
    // Found in a real browser that blocked storage: the page rendered cleanly
    // and told the reader their words would be kept. They would not have been.
    const real = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('blocked', 'SecurityError');
    };
    try {
      openOfflinePage();
      const banner = document.getElementById('banner')!.textContent ?? '';
      expect(banner).toMatch(/not letting Connections keep anything/);
      expect(banner).not.toMatch(/kept on this phone/);
      // And no form to type into and lose.
      expect(document.getElementById('form')!.hidden).toBe(true);
    } finally {
      Storage.prototype.setItem = real;
    }
  });

  it('shows the form when the device can store a note', () => {
    // The twin of the refusal above.
    openOfflinePage();
    expect(document.getElementById('form')!.hidden).toBe(false);
  });

  it('counts notes the app queued too', () => {
    queueNote({ client_ref: 'a', body: 'queued by the composer' });
    openOfflinePage();
    expect(document.getElementById('waiting')!.textContent).toContain('1');
  });
});

describe('the offline page translations', () => {
  it('every locale carries every key the English one has', () => {
    // The typed catalog cannot reach a static file, so this is the check that
    // stands in for "a missing translation fails the build".
    const code = new DOMParser().parseFromString(HTML, 'text/html').querySelector('script')!
      .textContent!;
    // Just the dictionary literal. The script is wrapped in an IIFE, so taking
    // "everything before `var lang`" leaves an unclosed function — which is how
    // the first version of this test failed while the page itself was fine.
    const literal = code.slice(code.indexOf('var I18N'), code.indexOf('var lang ='));
    const dict = new Function(`${literal} return I18N;`)() as Record<
      string,
      Record<string, string>
    >;
    const en = Object.keys(dict.en!).sort();
    for (const locale of ['nl', 'es', 'pt', 'de', 'fr']) {
      expect(Object.keys(dict[locale] ?? {}).sort(), locale).toEqual(en);
    }
  });
});

describe('signing out', () => {
  it('removes notes, any old people list and workspace from the device', () => {
    queueNote({ client_ref: 'a', body: 'x' });
    localStorage.setItem('connections:people', '{}');
    clearOfflineData();
    expect(queuedNotes()).toHaveLength(0);
    expect(Object.keys(localStorage).filter((k) => k.startsWith('connections:'))).toEqual([]);
  });

  it('leaves storage that is not Connections\' alone', () => {
    localStorage.setItem('some-other-app', 'keep me');
    clearOfflineData();
    expect(localStorage.getItem('some-other-app')).toBe('keep me');
  });
});
