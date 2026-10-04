'use client';

// RichTextField — the rich-text form field, for every app.
//
// Born in The Thread and moved here on 2026-10-04, when the profile bio
// needed the same editor: the rule is that a surface which exists anywhere is
// extracted rather than forked (CLAUDE.md, "Components first"). Thread's
// components/ui/rich-text.tsx is now a re-export shim, so its four call sites
// are untouched and there is one editor to fix when it is wrong.
//
// What it writes is HTML, and the API sanitises it where it ENTERS
// (apps/api/src/lib/rich-text.ts). What reads it back is `RichText`, next
// door. Those three files are the whole story of organiser rich text.
//
// A bordered container with a compact toolbar (bold / italic / lists /
// link / clear formatting) over a contentEditable surface. Emits a hidden
// input carrying the HTML so existing FormData-based forms work unchanged.
//
// Implementation: document.execCommand — deprecated but universally
// supported, and exactly right for a field this small. Uncontrolled after
// mount: defaultValue is rendered once, then the DOM owns the content.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bold,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
} from 'lucide-react';
import type { Locale } from '../i18n.js';
import { chromeT, type ChromeKey } from './i18n-ui.js';
import { RICH_TEXT_TYPOGRAPHY } from './rich-text.js';

type Command =
  | 'bold'
  | 'italic'
  | 'formatBlock'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'createLink'
  | 'removeFormat';

const TOOLS: { command: Command; icon: typeof Bold; labelKey: ChromeKey; stateful: boolean }[] = [
  // A heading, not headingS: one level is enough inside a form field, and
  // `formatBlock` toggles the block back to a paragraph when pressed again,
  // so it behaves like the other stateful buttons (Sjoerd asked for headers
  // on a thread's intention, 2026-09-10).
  { command: 'formatBlock', icon: Heading3, labelKey: 'heading', stateful: false },
  { command: 'bold', icon: Bold, labelKey: 'bold', stateful: true },
  { command: 'italic', icon: Italic, labelKey: 'italic', stateful: true },
  { command: 'insertUnorderedList', icon: List, labelKey: 'bullet_list', stateful: true },
  { command: 'insertOrderedList', icon: ListOrdered, labelKey: 'numbered_list', stateful: true },
  { command: 'createLink', icon: Link2, labelKey: 'rt_link', stateful: false },
  { command: 'removeFormat', icon: RemoveFormatting, labelKey: 'clear_formatting', stateful: false },
];

export function RichTextField({
  locale,
  label,
  name,
  defaultValue,
  hint,
  errors,
  onHtmlChange,
  minHeight = 96,
}: {
  locale: Locale;
  label: React.ReactNode;
  name: string;
  defaultValue?: string | null;
  hint?: React.ReactNode;
  /** Shown in red under the field, the same way the plain fields do it. */
  errors?: string[] | undefined;
  /** The HTML as it changes, for a caller that counts it or validates it
   *  before the save. The hidden input still carries it for FormData, so a
   *  caller that wants neither is unaffected. */
  onHtmlChange?: ((html: string) => void) | undefined;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  /** Set on the first input. After this, the seeding effect never writes
   *  again — an empty editor then means the person emptied it. */
  const userTyped = useRef(false);
  // The initial HTML is written into the div IMPERATIVELY on mount (effect
  // below) — React renders an empty div and never patches its contents, so
  // no re-render can clobber the user's typing or reset the caret. (The
  // dangerouslySetInnerHTML variant reset the caret to the start on some
  // re-renders — typed text came out reversed.)
  const initialHtml = useRef<string>(defaultValue ?? '');
  const [html, setHtml] = useState<string>(initialHtml.current);
  const [active, setActive] = useState<Partial<Record<Command, boolean>>>({});

  // Seeding, and why it is not a one-shot mount effect.
  //
  // It was: `useEffect(..., [])` wrote the HTML once and trusted it to stay.
  // On the profile screen it did not — the editor rendered EMPTY while the
  // hidden input carried all 3,567 characters, so the field looked blank and
  // saving it would have replaced a real bio with nothing (seen on staging,
  // 2026-10-04; writing into the box by hand stuck, so nothing was clearing
  // it afterwards — the write either never happened or went into a node that
  // was then thrown away). Thread's four screens never showed it because
  // their editors mount inside a dialog, well after hydration.
  //
  // So this runs after EVERY render until the content is actually in the
  // element, and stops the moment somebody types. The two rules together are
  // what make it safe:
  //   - only ever fills an EMPTY editor, so it cannot overwrite anyone's work;
  //   - never fills after the first keystroke, so clearing the field on
  //     purpose stays cleared.
  useEffect(() => {
    const el = editorRef.current;
    if (!el || userTyped.current || !initialHtml.current) return;
    if (el.innerHTML === '') el.innerHTML = initialHtml.current;
  });

  const refreshActive = useCallback(() => {
    const next: Partial<Record<Command, boolean>> = {};
    for (const t of TOOLS) {
      if (!t.stateful) continue;
      try {
        next[t.command] = document.queryCommandState(t.command);
      } catch {
        next[t.command] = false;
      }
    }
    setActive(next);
  }, []);

  // Track formatting state as the caret moves while the editor has focus.
  useEffect(() => {
    function onSelectionChange() {
      const el = editorRef.current;
      if (el && el.contains(document.getSelection()?.anchorNode ?? null)) {
        refreshActive();
      }
    }
    document.addEventListener('selectionchange', onSelectionChange);
    return () => document.removeEventListener('selectionchange', onSelectionChange);
  }, [refreshActive]);

  function sync() {
    userTyped.current = true;
    const next = editorRef.current?.innerHTML ?? '';
    setHtml(next);
    onHtmlChange?.(next);
  }

  function exec(command: Command) {
    editorRef.current?.focus();
    if (command === 'createLink') {
      // eslint-disable-next-line no-alert
      const url = window.prompt(chromeT(locale, 'link_url'));
      if (!url) return;
      document.execCommand('createLink', false, url);
    } else if (command === 'formatBlock') {
      // Toggle: pressing it inside a heading returns the block to a
      // paragraph, so the button never becomes a one-way door.
      const inHeading = document.queryCommandValue('formatBlock').toLowerCase().includes('h3');
      document.execCommand('formatBlock', false, inHeading ? 'p' : 'h3');
    } else {
      document.execCommand(command, false);
    }
    sync();
    refreshActive();
  }

  return (
    <div>
      <span className="text-sm text-ink-subtle">{label}</span>
      <input type="hidden" name={name} value={html} />
      <div className="mt-1 rounded-md border border-line bg-surface-raised focus-within:border-line-strong">
        <div className="sticky top-0 z-10 flex items-center gap-0.5 rounded-t-md border-b border-line bg-surface-raised px-1.5 py-1">
          {TOOLS.map(({ command, icon: Icon, labelKey, stateful }) => (
            <button
              key={command}
              type="button"
              aria-label={chromeT(locale, labelKey)}
              title={chromeT(locale, labelKey)}
              // preventDefault keeps the editor selection alive through the click.
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(command)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
                stateful && active[command]
                  ? 'bg-surface-sunken text-ink'
                  : 'text-ink-subtle hover:text-ink hover:bg-surface-sunken'
              }`}
            >
              <Icon size={16} strokeWidth={1.75} />
            </button>
          ))}
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          /* Without a name this is an unlabelled textbox: a screen reader
             announces nothing, and nothing can find it by its label either —
             which is how the e2e spec ended up driving a field that is not a
             textarea. The visible label is normally a plain string. */
          aria-label={typeof label === 'string' ? label : undefined}
          onInput={sync}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          style={{ minHeight }}
          className={`px-3 py-2 text-sm text-ink focus:outline-none ${RICH_TEXT_TYPOGRAPHY}`}
        />
      </div>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
      {errors?.map((e) => (
        <span key={e} className="mt-1 block text-xs text-red-700">
          {e}
        </span>
      ))}
    </div>
  );
}
