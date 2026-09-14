// A prompt somebody pastes into their own AI assistant, with a meeting
// transcript, to get back a short note this app understands.
//
// Sjoerd, 2026-09-14: *"what I often do is when I have meetings, I make
// transcribes... give it a prompt... a short report that includes @ for
// references to businesses and # for hashtags... a proper prompt that someone
// could paste into their ChatGPT or Claude or Gemini, whatever they use. And
// then there's output... a short summary, and that summary could be pasted in
// the what happened."*
//
// ── What leaves the building, and what deliberately does not ──────────────
//
// This text is copied to the clipboard and pasted into a service this platform
// does not control. So it carries the MINIMUM:
//
//   - the name of the person the note is about — who they are talking to is
//     already in the transcript they are about to paste beside it;
//   - the workspace's own TOPIC tags, so the summary reuses the words the
//     landscape already counts instead of inventing near-duplicates.
//
// It does NOT carry organisation tags or the names of anybody else in the
// workspace, even though both would make the output match better. An
// organisation word can be a sole trader's name, and a list of other people
// would be this workspace's contact graph handed to a third party because it
// was convenient. The transcript names whoever it names; this adds nobody.
//
// ── The shape of what comes back ───────────────────────────────────────────
//
// Multi-word tags and names are asked for WITH HYPHENS — `#deep-democracy`,
// `@Wilma-Doornbos` — because `#word` and `@word` end at a space. Detection
// folds hyphens back to spaces, which is the same convention the `#`/`@`
// suggestions write, so pasted output resolves to the tags and people it
// names.
//
// Pure, so it can be tested and so the component only decides where it goes.

export type MeetingPromptInput = {
  /** Who the note is about. */
  personName: string;
  /** The reader's interface language, so the summary comes back in it. */
  languageName: string;
  /** Topic tags this workspace already uses. Organisation tags are excluded. */
  topicTags: readonly string[];
  /** How many existing tags to offer at most — enough to steer, not a wall. */
  maxTags?: number;
};

const hyphenate = (s: string) => s.trim().replace(/\s+/g, '-');

export function meetingPrompt({
  personName,
  languageName,
  topicTags,
  maxTags = 40,
}: MeetingPromptInput): string {
  const tags = [...new Set(topicTags.map((t) => t.trim()).filter(Boolean))]
    .slice(0, maxTags)
    .map((t) => `#${hyphenate(t)}`);

  // Works in a fresh chat AND in one that has already been working on the
  // transcript. Sjoerd, 2026-09-14: *"The prompt should also work in a chat
  // that has already worked on a transcript"* — so it points at the transcript
  // wherever it is, and lets earlier corrections in that chat count.
  return [
    `I need a note about my meeting with ${personName}.`,
    '',
    'The transcript is either pasted below this message, or already earlier in this conversation. Use whichever is there. If we have already discussed it here, take what we worked out into account (corrections, names, what matters), but still follow the format below exactly — it replaces any earlier format.',
    '',
    `Write a short note about the meeting in ${languageName}, for a relationship log. Plain text, no headings, no markdown, no bullet symbols other than a dash.`,
    '',
    'Structure:',
    '- Two to four sentences on what was discussed and what matters about it.',
    '- Then, if there are any: "Agreed:" followed by decisions, one per line.',
    '- Then, if there are any: "Next:" followed by concrete follow-ups, one per line, with who does it.',
    '',
    'Conventions — follow these exactly, because the note is read by software:',
    '- Write every person and every organisation that is named in the transcript with @ in front, and join the words of a name with hyphens: @Wilma-Doornbos, @EBBF, @Zaailing-Collectief.',
    '- Write topics as hashtags, joining words with hyphens: #deep-democracy. Use at most five.',
    tags.length
      ? `- Prefer these existing hashtags when they fit, and only invent a new one when none does: ${tags.join(' ')}`
      : '- Invent hashtags only for topics that clearly matter.',
    '- Do not name anyone who is not in the transcript. Do not guess at facts that are not in it.',
    '- Keep the whole note under 120 words.',
    '',
    // Sjoerd, 2026-09-14: "if the data from what is there is not clear enough,
    // maybe the prompt can help to ask a few questions to clarify it?"
    'Before you write: if something essential is unclear — who a person or organisation is, what was actually agreed, or what the next step is and who takes it — ask me up to three short, numbered questions first, and nothing else. Write the note after I answer. If everything essential is clear, skip the questions.',
    '',
    'When you write the note, reply with the note only.',
    '',
    '--- TRANSCRIPT (paste here, or leave empty if it is already in this chat) ---',
    '',
  ].join('\n');
}
