'use client';

// A text box whose tags are marked inside the sentence.
//
// D71. Sjoerd, 2026-09-12: *"when typing... and a word is finished... it can
// turn it into a tag"*.
//
// ── The design decision, which is the whole file ────────────────────────────
//
// The obvious way to mark words inside a text box is to replace the box with a
// contentEditable and put real elements in the text. That is also how
// autocorrect, the caret, IME composition for accented and non-Latin input,
// undo, and paste all quietly break — worst of all on phones, which is where
// this app is used. So the real <textarea> is left exactly as it was: native
// typing, native caret, native undo, visible text.
//
// The highlights are painted by a MIRROR behind it: a div with identical
// metrics holding the same text, transparent except for a tint under each
// tag. The textarea's own background is transparent, so the tint shows through
// beneath the real letters. Nothing the person types passes through anything
// but the browser's own text box.
//
// ── What that trade costs, stated rather than hidden ────────────────────────
//
// There is no X on the word itself. A clickable element in the sentence would
// sit on top of the text box and steal the tap that places the caret there, so
// editing a highlighted word would mean aiming around it. Removing a tag stays
// on its chip below; hovering or focusing a chip lights its word up in the
// sentence, so the two are visibly the same thing.
//
// The layers only line up if they share every metric that affects wrapping.
// Tailwind's preflight zeroes a textarea's padding and border, and the mirror
// copies font size, line height, letter spacing and wrapping below. If you
// restyle the textarea, restyle the mirror in the same commit.

import { useRef } from 'react';
import type { HighlightRange } from '@/lib/detect-tags';

const TINT: Record<HighlightRange['kind'], string> = {
  // Soft enough that the black text above stays fully legible; a person is a
  // different colour from a tag, because they are different things.
  tag: 'rgb(234 179 8 / 0.28)',
  organisation: 'rgb(59 130 246 / 0.22)',
  person: 'rgb(16 185 129 / 0.24)',
};

/** Shared by both layers so they cannot drift apart. */
// text-base sm:text-sm is FIELD_TEXT from @thefibre/shared/ui/fields, spelled
// out because both layers must carry the identical string (see above).
const METRICS = 'w-full text-base sm:text-sm leading-relaxed tracking-normal whitespace-pre-wrap break-words';

export function TagHighlightBox({
  value,
  onChange,
  ranges,
  activeKey,
  placeholder,
  ariaLabel,
  rows = 3,
  textareaRef,
  onKeyDown,
  onCaret,
}: {
  value: string;
  onChange: (next: string) => void;
  ranges: HighlightRange[];
  /** The folded name of a tag whose chip is hovered, lit more strongly. */
  activeKey: string | null;
  placeholder: string;
  ariaLabel: string;
  rows?: number;
  /** For the `#`/`@` suggestions, which need to put the caret back after a pick. */
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /** Arrow keys and Enter belong to the suggestion list while it is open. */
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  /** Where the caret is, on every change, click and arrow key. */
  onCaret?: (caret: number) => void;
}) {
  const mirror = useRef<HTMLDivElement>(null);

  // Build the mirror's children: plain text with a span under each range.
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    if (r.start > at) parts.push(value.slice(at, r.start));
    const active = activeKey !== null && r.key === activeKey;
    parts.push(
      <mark
        key={i}
        data-kind={r.kind}
        style={{
          background: TINT[r.kind],
          color: 'transparent',
          borderRadius: 3,
          // A shadow gives the tint breathing room WITHOUT padding, which would
          // widen the word in the mirror and push every later line out of
          // alignment with the real text above it.
          boxShadow: `0 0 0 ${active ? 3 : 1.5}px ${TINT[r.kind]}`,
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}
      >
        {value.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  });
  if (at < value.length) parts.push(value.slice(at));
  // A trailing newline in a textarea opens an empty last line; a div collapses
  // it. The zero-width space keeps the two the same height.
  parts.push('\u200B');

  return (
    <div className="relative">
      <div
        ref={mirror}
        aria-hidden="true"
        className={`${METRICS} pointer-events-none absolute inset-0 overflow-hidden text-transparent`}
      >
        {parts}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          onCaret?.(e.target.selectionStart);
        }}
        // `select` fires for clicks and arrow keys too, which is what lets the
        // list close when somebody moves the caret away from the word.
        onSelect={(e) => onCaret?.(e.currentTarget.selectionStart)}
        onKeyDown={onKeyDown}
        // The mirror has to scroll with the text it sits under, or a long note
        // shows its highlights against the wrong lines.
        onScroll={(e) => {
          if (mirror.current) mirror.current.scrollTop = e.currentTarget.scrollTop;
        }}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`${METRICS} relative resize-y bg-transparent placeholder:text-ink-muted focus:outline-none`}
      />
    </div>
  );
}

/**
 * A saved note, with its tags and names marked the same way the box marks
 * them while typing.
 *
 * Sjoerd, 2026-09-13: *"In de timeline, highlight tags. companies or people
 * should be an @ and also highlighted."* Lost that day (ask 18) and built the
 * next. The TINT lives in this file once, so a word looks like the same thing
 * in the box you type it into and in the timeline you read it back from.
 *
 * Unlike the mirror above, the text here is the visible text — there is no
 * textarea on top — so the letters keep their colour and only the ground is
 * tinted.
 */
export function HighlightedText({ text, ranges }: { text: string; ranges: HighlightRange[] }) {
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach((r, i) => {
    if (r.start < at) return; // overlapping ranges: the first one wins
    if (r.start > at) parts.push(text.slice(at, r.start));
    parts.push(
      <mark
        key={i}
        data-kind={r.kind}
        className="text-inherit"
        style={{
          background: TINT[r.kind],
          color: 'inherit',
          borderRadius: 3,
          boxShadow: `0 0 0 1.5px ${TINT[r.kind]}`,
          boxDecorationBreak: 'clone',
          WebkitBoxDecorationBreak: 'clone',
        }}
      >
        {text.slice(r.start, r.end)}
      </mark>,
    );
    at = r.end;
  });
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}
