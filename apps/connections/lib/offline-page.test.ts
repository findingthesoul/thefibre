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
  cachePeople,
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

describe('the offline page writes what the app reads', () => {
  it('a note written on the offline page is picked up by the app queue', async () => {
    cachePeople('ws1', [
      { id: '11111111-1111-4111-8111-111111111111', name: 'Wilma Doornbos' },
    ]);
    openOfflinePage();

    // Pick the person, type, keep.
    const personButton = [...document.querySelectorAll('#people button')][0] as HTMLButtonElement;
    expect(personButton.textContent).toBe('Wilma Doornbos');
    personButton.click();

    const body = document.getElementById('body') as HTMLTextAreaElement;
    body.value = 'Spoke in the corridor about the retreat.';
    body.dispatchEvent(new Event('input'));

    const form = document.getElementById('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    const q = queuedNotes('ws1');
    expect(q).toHaveLength(1);
    expect(q[0]).toMatchObject({
      person_id: '11111111-1111-4111-8111-111111111111',
      body: 'Spoke in the corridor about the retreat.',
      kind: 'note',
      is_draft: false,
    });
    // A committed note needs these to pass PUT /notes validation.
    expect(q[0]!.client_ref).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof q[0]!.happened_at).toBe('string');
  });

  it('stamps the note with the workspace it was written in', () => {
    cachePeople('ws1', [{ id: '11111111-1111-4111-8111-111111111111', name: 'Wilma' }]);
    openOfflinePage();
    (document.querySelector('#people button') as HTMLButtonElement).click();
    const body = document.getElementById('body') as HTMLTextAreaElement;
    body.value = 'about the retreat';
    body.dispatchEvent(new Event('input'));
    (document.getElementById('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { cancelable: true }),
    );
    // Visible to ws1, invisible to another workspace.
    expect(queuedNotes('ws1')).toHaveLength(1);
    expect(queuedNotes('ws2')).toHaveLength(0);
  });

  it('never offers another workspace\'s people', () => {
    cachePeople('ws-other', [{ id: 'x', name: 'Somebody Elsewhere' }]);
    openOfflinePage();
    expect(document.querySelectorAll('#people button')).toHaveLength(0);
    expect(document.getElementById('empty')!.hidden).toBe(false);
  });

  it('renders a person\'s name as text, never as markup', () => {
    // A name is data. innerHTML here would turn a hostile name into script.
    cachePeople('ws1', [{ id: 'x', name: '<img src=x onerror=alert(1)>' }]);
    openOfflinePage();
    const button = document.querySelector('#people button')!;
    expect(button.querySelector('img')).toBeNull();
    expect(button.textContent).toBe('<img src=x onerror=alert(1)>');
  });

  it('does not promise to keep a note when the device refuses to store one', () => {
    // Found in a real browser that blocked storage: the page rendered cleanly
    // and told the reader their words would be kept. They would not have been.
    cachePeople('ws1', [{ id: 'x', name: 'Wilma' }]);
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

  it('counts notes the app queued too', () => {
    queueNote({ client_ref: 'a', body: 'queued by the composer' });
    cachePeople('ws1', [{ id: 'x', name: 'Wilma' }]);
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
  it('removes notes, people and workspace from the device', () => {
    queueNote({ client_ref: 'a', body: 'x' });
    cachePeople('ws1', [{ id: 'p', name: 'Wilma' }]);
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
