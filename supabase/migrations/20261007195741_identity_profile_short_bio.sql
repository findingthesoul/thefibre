-- A short bio, beside the full one.
--
-- Sjoerd, 2026-10-07: "short bio yes". The full bio is rich text and runs to
-- thousands of characters; it belongs on a person's own page. Wherever space
-- is small — the left column of a Meet booking page, a meta description, a
-- social card — a few lines are what fits, and until now those spots either
-- showed nothing or cut the full bio wherever the box ended.
--
-- Plain text, nullable. NULL means "not written": readers then fall back to
-- the opening of the full bio, cut at a word boundary — computed in ONE
-- helper, `resolveShortBio` in packages/shared/src/short-bio.ts, never here.
--
-- The length limit is NOT a constraint in this table on purpose: it lives in
-- packages/shared/src/field-limits.ts, where both the form and the API's
-- zod schema read it (the bio has no column constraint either, for the same
-- reason — one number, one home).
--
-- On identity_profile because that is where a person's face lives
-- (display_name, bio, photo_url), keyed by email so it follows them between
-- workspaces. The table's policies already cover the new column; nothing
-- about who may read or write it changes.

alter table public.identity_profile
  add column if not exists short_bio text;

comment on column public.identity_profile.short_bio is
  'A few lines about this person, plain text, for compact spots (Meet booking '
  'pages, meta descriptions). NULL = not written; readers fall back to the '
  'opening of `bio` via resolveShortBio in @thefibre/shared.';
