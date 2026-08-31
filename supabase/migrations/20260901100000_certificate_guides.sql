-- Alignment guides on a certificate template (Sjoerd 2026-08-31: "with
-- template"). Design aids, not content: they help place elements and are
-- never part of an issued certificate, which is why they live in their own
-- column rather than among `elements` — the issued snapshot copies elements,
-- so guides stay out of it by construction.
--
-- Shape: [{ "axis": "x" | "y", "pos": <percent 0-100> }]
alter table public.thread_certificate_template
  add column guides jsonb not null default '[]'::jsonb;
