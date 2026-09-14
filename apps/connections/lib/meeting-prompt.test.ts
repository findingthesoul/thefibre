// The meeting prompt: what it carries out of the building, and whether what
// comes back is something this app can read.

import { describe, expect, it } from 'vitest';
import { meetingPrompt } from './meeting-prompt';
import { detectMentions, detectTags } from './detect-tags';

describe('the meeting prompt', () => {
  const base = { personName: 'Wilma Doornbos', languageName: 'English', topicTags: ['deep democracy', 'retreat'] };

  it('names the person and the language', () => {
    const p = meetingPrompt(base);
    expect(p).toContain('Wilma Doornbos');
    expect(p).toContain('in English');
  });

  it('offers existing topic tags in the hyphenated form detection reads', () => {
    expect(meetingPrompt(base)).toContain('#deep-democracy #retreat');
  });

  it('carries only the tags it is given — the caller filters out organisations', () => {
    // The privacy line lives in what the caller passes. This pins that the
    // prompt adds nothing of its own: no other names, no workspace list.
    const p = meetingPrompt({ ...base, topicTags: [] });
    expect(p).not.toContain('Prefer these existing hashtags');
    expect(p).toContain('Invent hashtags only');
  });

  it('caps how many tags it offers', () => {
    const many = Array.from({ length: 100 }, (_, i) => `topic${i}`);
    const listed = meetingPrompt({ ...base, topicTags: many, maxTags: 10 }).match(/#topic\d+/g) ?? [];
    expect(listed).toHaveLength(10);
  });

  it('ends ready for the transcript to be pasted straight after it', () => {
    expect(meetingPrompt(base).trimEnd().endsWith('already in this chat) ---')).toBe(true);
  });

  it('also works in a chat that has already worked on the transcript', () => {
    // Sjoerd, 2026-09-14. Pasted into an ongoing conversation, there is no
    // transcript below it — the prompt has to say to look earlier, and that
    // its format wins over whatever format was used before.
    const p = meetingPrompt(base);
    expect(p).toContain('already earlier in this conversation');
    expect(p).toContain('it replaces any earlier format');
  });
});

describe('what an assistant sends back, following the prompt', () => {
  // The round trip the conventions exist for: a note written the way the
  // prompt asks is recognised as the tags and people it names.
  const reply =
    'Talked with @Wilma-Doornbos about the spring #retreat and #deep-democracy training at @Zaailing-Collectief.';

  it('resolves the hashtags to the existing tags', () => {
    const tags = detectTags(`${reply} `, [
      { id: 't1', name: 'deep democracy' },
      { id: 't2', name: 'retreat' },
    ]);
    expect(tags.map((t) => t.name).sort()).toEqual(['deep democracy', 'retreat']);
  });

  it('resolves @names to the person and the organisation', () => {
    const mentions = detectMentions(
      `${reply} `,
      [{ id: 'p1', name: 'Wilma Doornbos' }],
      [{ id: 'o', name: 'Zaailing Collectief', organisationId: 'o2' }],
    );
    expect(mentions.map((m) => m.id).sort()).toEqual(['o2', 'p1']);
  });
});
