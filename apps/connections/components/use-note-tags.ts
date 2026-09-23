'use client';

// What a box of typed text knows about the people and things in it.
//
// Born 2026-09-23, extracted from the person page's composer, because the
// meeting write-up needed the same thing and Sjoerd found the gap by using
// it: *"Also: # is not working here."* He was right — the write-up box was a
// plain `<textarea>`, so a hashtag was still DETECTED and saved (the server
// reads the text), but nothing lit up while he typed and there was no way to
// take a tag back off a word.
//
// The rule this follows is the repo's, not a preference: never fork a second
// per-surface variant. Two copies of "which words in this sentence are tags"
// would drift the moment one of them learned something — and the failure
// would be silent, because each copy is valid on its own. That is the shape
// that has produced most of this codebase's inert features.
//
// What is deliberately NOT here: the `#`/`@` autocomplete dropdown. It owns
// caret position, a selection index and an insert that has to put the caret
// back after a controlled re-render (lib/autocomplete.ts). The person page
// keeps that; the write-up gets highlighting and the X. Adding it here later
// is an extension of this hook rather than a second one — but it is a real
// piece of work and pretending otherwise would ship it half-built.

import { useEffect, useState } from 'react';
import { fetchVocabulary } from '@/app/(app)/people/[id]/actions';
import {
  detectMentions,
  detectTags,
  foldKey,
  highlightRanges,
  type DetectedMention,
  type DetectedTag,
  type HighlightRange,
  type KnownPerson,
  type KnownTag,
} from '@/lib/detect-tags';

export type NoteTags = {
  /** Everything the vocabulary knows, for an autocomplete that wants it. */
  vocabulary: KnownTag[];
  mentionable: KnownPerson[];
  /** `#` words still standing — the X removes one from here. */
  tags: DetectedTag[];
  mentions: DetectedMention[];
  peopleMentioned: DetectedMention[];
  orgsMentioned: DetectedMention[];
  /** Where each one sits in the sentence, for TagHighlightBox. */
  ranges: HighlightRange[];
  /** The chip being pointed at, so its word lights up in the sentence. */
  activeKey: string | null;
  setActiveKey: (key: string | null) => void;
  /** The X: keep the word, drop the tag. */
  unmake: (r: { kind: string; key: string }) => void;
  dismissed: Set<string>;
};

export function useNoteTags(body: string): NoteTags {
  const [vocabulary, setVocabulary] = useState<KnownTag[]>([]);
  const [mentionable, setMentionable] = useState<KnownPerson[]>([]);
  /**
   * Tags taken off. Sjoerd, 2026-09-12: *"clicking it can also X the tag and
   * keep it as a word"* — removing a tag must not remove the word from the
   * sentence, and re-typing the word must not bring the tag back, or the X
   * would be a delay rather than a decision. Keyed by FOLDED name so a
   * different capitalisation is the same refusal.
   */
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchVocabulary()
      .then((v) => {
        if (!alive) return;
        setVocabulary(v.words);
        setMentionable(v.people);
      })
      // Silent: without the vocabulary nothing is detected and the box is
      // exactly the box it was before this feature. A banner would make a
      // working note-taking box look broken over a missing garnish.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const tags = detectTags(body, vocabulary).filter(
    // foldKey, not toLowerCase: a highlight range is keyed by fold()
    // (lowercase, punctuation to spaces), so "Deep-Democracy" is "deep
    // democracy" there and was "deep-democracy" here. The X would have added
    // a key this filter never looked for, and done nothing at all.
    (t) => !dismissed.has(foldKey(t.name)),
  );

  // `@` — people and organisations, resolved from what was typed. An
  // organisation mention is already a tag (an organisation IS a
  // characteristic of the people in it), so only PEOPLE need their own list.
  const mentions = detectMentions(body, mentionable, vocabulary).filter(
    (m) => !dismissed.has(`@${foldKey(m.name)}`),
  );

  return {
    vocabulary,
    mentionable,
    tags,
    mentions,
    peopleMentioned: mentions.filter((m) => m.kind === 'person'),
    orgsMentioned: mentions.filter((m) => m.kind === 'organisation'),
    // From the SAME detection results the chips show, so the two can never
    // disagree about a word.
    ranges: highlightRanges(body, tags, mentions),
    activeKey,
    setActiveKey,
    // A person and a tag are keyed differently because they are different
    // things and the filters above read them apart.
    unmake: (r) =>
      setDismissed((d) => new Set(d).add(r.kind === 'person' ? `@${r.key}` : r.key)),
    dismissed,
  };
}
