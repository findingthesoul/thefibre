'use client';

// RichTextField — minimal rich-text form field for The Thread.
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
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
} from 'lucide-react';

type Command =
  | 'bold'
  | 'italic'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'createLink'
  | 'removeFormat';

const TOOLS: { command: Command; icon: typeof Bold; label: string; stateful: boolean }[] = [
  { command: 'bold', icon: Bold, label: 'Bold', stateful: true },
  { command: 'italic', icon: Italic, label: 'Italic', stateful: true },
  { command: 'insertUnorderedList', icon: List, label: 'Bullet list', stateful: true },
  { command: 'insertOrderedList', icon: ListOrdered, label: 'Numbered list', stateful: true },
  { command: 'createLink', icon: Link2, label: 'Link', stateful: false },
  { command: 'removeFormat', icon: RemoveFormatting, label: 'Clear formatting', stateful: false },
];

export function RichTextField({
  label,
  name,
  defaultValue,
  hint,
  minHeight = 96,
}: {
  label: React.ReactNode;
  name: string;
  defaultValue?: string | null;
  hint?: React.ReactNode;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  // Rendered ONCE via dangerouslySetInnerHTML; the ref keeps it stable so
  // re-renders never clobber what the user is typing.
  const initialHtml = useRef<string>(defaultValue ?? '');
  const [html, setHtml] = useState<string>(initialHtml.current);
  const [active, setActive] = useState<Partial<Record<Command, boolean>>>({});

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
    setHtml(editorRef.current?.innerHTML ?? '');
  }

  function exec(command: Command) {
    editorRef.current?.focus();
    if (command === 'createLink') {
      // eslint-disable-next-line no-alert
      const url = window.prompt('Link URL');
      if (!url) return;
      document.execCommand('createLink', false, url);
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
        <div className="flex items-center gap-0.5 border-b border-line px-1.5 py-1">
          {TOOLS.map(({ command, icon: Icon, label: toolLabel, stateful }) => (
            <button
              key={command}
              type="button"
              aria-label={toolLabel}
              title={toolLabel}
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
          onInput={sync}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          style={{ minHeight }}
          className="px-3 py-2 text-sm text-ink focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: initialHtml.current }}
        />
      </div>
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}
