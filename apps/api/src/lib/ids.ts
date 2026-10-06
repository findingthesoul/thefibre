// Is this string a uuid?
//
// Needed because a public query parameter lands straight in a `.eq()` on a
// uuid column, and Postgres answers a non-uuid with `22P02 invalid input
// syntax for type uuid`. PostgREST turns that into a 400, routes turn it into
// a 500, and the caller gets the database's own words. So anything taking an
// id from a URL asks this first and resolves a slug instead — the pattern
// `routes/activities.ts` already used for `?app_id=`, now written once.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return !!value && UUID.test(value);
}
