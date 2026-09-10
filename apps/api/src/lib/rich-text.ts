// Sanitising organiser-authored rich text before it is stored.
//
// The Thread's rich-text fields — an engagement's body and description, and
// from 2026-09-10 a thread's intention — are written by an organiser and then
// rendered with `dangerouslySetInnerHTML` on a PUBLIC page and inside emails.
// That is a stored-XSS path: not from a stranger, but from anyone the
// workspace has made an organiser, aimed at that workspace's own visitors.
// The exposure predates this file; what it did not have was a sanitiser.
//
// Sanitised on the way IN rather than on the way out, because the way out is
// four surfaces and counting (thread page, thread embed, portal, email) and
// only one of them has to forget.
//
// The allowlist is what the editor's own toolbar can produce plus what a
// paste from a document reasonably carries — and nothing else. No <script>,
// no event handlers, no <iframe>, no <style>, no `javascript:` (DOMPurify
// drops that class on its own; the explicit lists are the belt).

import DOMPurify from 'isomorphic-dompurify';

/** Tags the toolbar emits, plus the ones a paste from Word or Docs brings. */
const ALLOWED_TAGS = [
  'p', 'br', 'div', 'span',
  'b', 'strong', 'i', 'em', 'u', 's',
  'ul', 'ol', 'li',
  'a',
  'h1', 'h2', 'h3', 'h4',
  'blockquote', 'code', 'pre', 'hr',
];

/** `target`/`rel` survive so a link the organiser made open-in-new-tab stays
 *  that way; `href` is the only attribute that can carry a payload and
 *  DOMPurify's URI policy handles it. */
const ALLOWED_ATTR = ['href', 'target', 'rel', 'title'];

/**
 * Clean HTML, safe to store and to render with dangerouslySetInnerHTML.
 *
 * Returns null for input that is empty once cleaned, so a caller can store
 * NULL rather than an empty `<p></p>` — the difference between "no intention"
 * and "an intention that renders as a blank line".
 */
export function sanitizeRichText(html: string | null | undefined): string | null {
  if (html == null) return null;
  const clean = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // A stored fragment, never a whole document.
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form', 'input'],
    FORBID_ATTR: ['style', 'srcset', 'formaction'],
  });
  // Tags alone are not content: `<p><br></p>` is what an emptied editor
  // leaves behind, and it should read as nothing.
  const text = clean.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length > 0 ? clean : null;
}
