// The member page's shared rules: the tags a community admin can type into
// the introduction and the one function that fills them, and which link
// addresses a document entry may hold — shared, so the editor's chips and
// the API that replaces them can never offer and honour different sets.
//
// Sjoerd, 2026-10-14: "Can you add tags for the textfield {first_name} etc."
//
// The names agree with what already exists: `{community}` and `{tier}` are
// the membership emails' own words, and `{name}` (a thread message's first
// name) is accepted as an alias, not offered, so a tag copied from a thread
// message still works here.
//
// SAFETY. The intro is stored SANITISED (rich-text allow-list). Filling
// happens at READ time, per member, AFTER that, so each value goes in
// HTML-escaped: a member called `<script>` is shown as text and can inject
// nothing, in a text node or inside an attribute. An unknown tag is left as
// typed, so the admin sees the typo on the page; a known tag with no value
// (no last name) becomes empty, never the literal `{last_name}`.

export const MEMBER_PAGE_TAGS = ['first_name', 'last_name', 'community', 'tier', 'next_event'] as const;
export type MemberPageTag = (typeof MEMBER_PAGE_TAGS)[number];

/** Accepted but not offered: the spelling other Fibre texts use. */
const ALIASES: Record<string, MemberPageTag> = { name: 'first_name' };

export type MemberPageTagValues = Partial<Record<MemberPageTag, string | null | undefined>>;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Fill the tags in already-sanitised HTML with escaped per-member values. */
export function fillMemberPageTags(html: string, values: MemberPageTagValues): string {
  return html.replace(/\{([a-z_]+)\}/g, (whole, raw: string) => {
    const tag = (MEMBER_PAGE_TAGS as readonly string[]).includes(raw) ? (raw as MemberPageTag) : ALIASES[raw];
    if (!tag) return whole;
    return escapeHtml((values[tag] ?? '').trim());
  });
}

/** An address a member may be sent to from a document entry: http or https
 *  only — never `javascript:` or `data:`, which a click would run on the
 *  my.thread origin. Returns the normalised URL, or null. Shared so the
 *  editor refuses before the save and the API refuses at the door. */
export function safeLinkUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();
  if (!s || s.length > 2000) return null;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  if (!u.hostname) return null;
  return u.toString();
}
