-- The function comment still described the world before the stage log.
--
-- 20260913030000 taught the opportunity axis to read
-- pulse_commitment_stage_event, but carried forward the comment saying
-- "closeness and opportunity read current-state columns with no history".
-- Half of that is now false, and a comment on a function is the first thing
-- the next person reads. Its own statement rather than an edit to the
-- previous file, because Supabase tracks migrations by filename and an
-- already-applied file is a no-op on remote.
comment on function public.connections_landscape_axis(uuid, text, timestamptz) is
  'The same population re-segmented by a chosen axis, in one shape: (person_id, band). docs/connections-mobile.md §2, D32. maturity delegates to connections_landscape. p_as_of is honoured by maturity, cadence, contribution and — since the stage log of 20260913010000 — opportunity. Only closeness reads a current-state column with no history and returns today''s value at every cutoff, deliberately, rather than inventing one.';
