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
// ── The X on the word ───────────────────────────────────────────────────────
//
// This file used to say there could not be one: a clickable element in the
// sentence sits on top of the text box and steals the tap that places the
// caret. That reasoning was right about a clickable WORD and wrong as a
// conclusion, and the gap it left became real when Sjoerd had the chip row
// taken away on 2026-09-15 ("this is not needed") — the chips were the only
// thing that could unmake a tag, so after that nothing could. He asked for it
// back where it belongs, on 2026-09-22: *"mouse over also shows the X to turn
// the # into a word again"*.
//
// So: not a clickable word, a clickable X. One small button, drawn over the
// END of the word it belongs to, in a layer that is `pointer-events: none`
// everywhere except those few pixels. Every other point in the box still
// places the caret exactly as before, including inside the tagged word.
//
// It appears on hover — and also whenever the CARET is inside the word, which
// is the same affordance for a phone, where there is no hover and a tap is how
// you reach a word anyway.
//
// The positions come from measuring the mirror's own <mark> elements, so they
// cannot drift from the tint: it is the same element.
//
// The layers only line up if they share every metric that affects wrapping.
// Tailwind's preflight zeroes a textarea's padding and border, and the mirror
// copies font size, line height, letter spacing and wrapping below. If you
// restyle the textarea, restyle the mirror in the same commit.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
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
  onUnmake,
  caret,
  unmakeLabel = 'Keep the word, drop the tag',
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
  /** Unmake the range under the X: it stops being a tag or a mention and
   *  stays in the sentence as an ordinary word. Omitted, no X is drawn. */
  onUnmake?: (range: HighlightRange) => void;
  /** The caret, so the X can show for the word it sits in — hover's stand-in
   *  on a touch screen. */
  caret?: number | null;
  /** What the X says to a screen reader and on hover. */
  unmakeLabel?: string;
}) {
  const mirror = useRef<HTMLDivElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  /** Where each range is on screen, measured from the mirror's own marks. */
  const [boxes, setBoxes] = useState<{ left: number; top: number }[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);

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

  // Measured after every paint that could move a word: the text, the ranges,
  // and the box's own width all change where a mark ends.
  const measure = useCallback(() => {
    if (!onUnmake || !mirror.current || !wrap.current) return;
    const base = wrap.current.getBoundingClientRect();
    const marks = mirror.current.querySelectorAll('mark');
    const next: { left: number; top: number }[] = [];
    marks.forEach((m) => {
      // The LAST rect, not the bounding box: a word that wraps across two
      // lines ends on the second one, and that is where the X belongs.
      const rects = m.getClientRects();
      const r = rects[rects.length - 1];
      if (!r) return;
      next.push({ left: r.right - base.left, top: r.top - base.top });
    });
    setBoxes(next);
  }, [onUnmake]);

  useLayoutEffect(measure, [measure, value, ranges]);
  useEffect(() => {
    if (!onUnmake) return;
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measure, onUnmake]);

  /** The range the caret sits in — hover's equivalent where there is none. */
  const atCaret =
    caret === null || caret === undefined
      ? -1
      : ranges.findIndex((r) => caret >= r.start && caret <= r.end);
  const showing = hovered ?? (atCaret >= 0 ? atCaret : null);

  return (
    <div className="relative" ref={wrap}>
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
          measure();
        }}
        // Hit-testing on the TEXTAREA, because it is the layer the pointer
        // actually reaches — the mirror is behind it and takes no events.
        // Comparing against the measured marks is what lets a word be
        // "hovered" without anything being placed over it.
        onMouseMove={
          onUnmake
            ? (e) => {
                const base = wrap.current?.getBoundingClientRect();
                const marks = mirror.current?.querySelectorAll('mark');
                if (!base || !marks) return;
                const x = e.clientX - base.left;
                const y = e.clientY - base.top;
                let found: number | null = null;
                marks.forEach((m, i) => {
                  for (const r of Array.from(m.getClientRects())) {
                    if (
                      x >= r.left - base.left &&
                      x <= r.right - base.left &&
                      y >= r.top - base.top &&
                      y <= r.bottom - base.top
                    ) {
                      found = i;
                    }
                  }
                });
                setHovered(found);
              }
            : undefined
        }
        onMouseLeave={onUnmake ? () => setHovered(null) : undefined}
        rows={rows}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={`${METRICS} relative resize-y bg-transparent placeholder:text-ink-muted focus:outline-none`}
      />

      {/* The X layer. `pointer-events-none` on the layer and `auto` on the
          button alone, so the only place in the whole box that does not place
          the caret is the X itself. */}
      {onUnmake && showing !== null && ranges[showing] && boxes[showing] && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setHovered(showing)}
            onClick={() => {
              onUnmake(ranges[showing]!);
              setHovered(null);
            }}
            title={unmakeLabel}
            aria-label={unmakeLabel}
            style={{ left: boxes[showing]!.left - 2, top: boxes[showing]!.top - 2 }}
            className="pointer-events-auto absolute flex h-4 w-4 items-center justify-center rounded-full bg-ink text-ink-inverse shadow-sm"
          >
            <X size={10} strokeWidth={2.5} />
          </button>
        </div>
      )}
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
