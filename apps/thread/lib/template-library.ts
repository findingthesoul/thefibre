// The template library's shape and its empty fallback, in a PLAIN module.
//
// Server pages (templates/page.tsx, threads/new/page.tsx) use EMPTY_LIBRARY
// as the fallback when GET /thread/template-library fails. It lived in the
// 'use client' components/template-cards.tsx, and a value imported from a
// client module reaches the server as a client reference, not the object —
// so on that failure the Templates page's `library.templates.length` would
// have thrown "Application error" instead of showing the page without
// templates. Found by the client-value guard once it followed `@/` imports
// (2026-10-17); same pattern as lib/thread-status-filter.ts.

/** GET /api/v1/thread/template-library response. */
export type LibraryTemplate = {
  id: string;
  available: boolean;
  elements: { type: string; title: string; days: number }[];
};
export type TemplateLibrary = {
  templates: LibraryTemplate[];
  can_edit_structure: boolean;
};

/** Fallback when the library couldn't be fetched — hide pickers, gate open. */
export const EMPTY_LIBRARY: TemplateLibrary = { templates: [], can_edit_structure: true };
