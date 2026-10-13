// Turning a refused API call into something a person can read.
//
// WHY THIS IS SHARED. Thirteen copies of the same `unwrap` helper existed
// across the apps, and twelve of them threw the API's own sentence away:
//
//     const apiBody = e.body as { error?: { fieldErrors?: … } } | undefined;
//     return { error: `API ${e.status}`, fieldErrors: apiBody?.error?.fieldErrors };
//
// The cast says the body's `error` is an OBJECT of field errors. For a
// validation failure it is. For everything else the API answers
// `{ error: "only admins can change members" }` — a string — and that branch
// cannot see it, so the screen says "API 403".
//
// That is not a cosmetic difference. On 2026-10-14 Sjoerd could not change
// the role of a member in a workspace where he is not an admin, and the
// dialog reverted the select showing "API 403". The API had answered "only
// admins can change members", which would have told him the cause outright.
// The one copy that got it right (programmes/actions.ts) is the shape kept
// here.
//
// It takes the status and the body rather than the error object, because
// `ApiError` is declared per app (`@/lib/api`) and this package must not
// reach into an app. The `instanceof` check stays at the call site, where the
// class is in scope.

/** What a server action hands back to the component that called it. */
export type ActionResult = {
  ok?: boolean;
  error?: string | undefined;
  fieldErrors?: Record<string, string[]> | undefined;
};

/** The API's own words where it gave any, the status where it did not.
 *
 *  Both shapes of `error` are handled: a string is a sentence meant for a
 *  person, an object may carry `fieldErrors` for a form. `message` is read as
 *  a fallback because some routes answer that way. */
export function apiErrorResult(status: number, body: unknown): ActionResult {
  const b = body as
    | {
        error?: { fieldErrors?: Record<string, string[]> } | string;
        message?: string;
        detail?: string;
      }
    | undefined;
  const fieldErrors =
    b?.error && typeof b.error === 'object' ? b.error.fieldErrors : undefined;
  const message =
    typeof b?.error === 'string'
      ? b.error
      : typeof b?.message === 'string'
        ? b.message
        : // `detail` is what the problem+json routes use (type/title/status/
          // detail), so a 401 from those reads "Bearer token required"
          // rather than "API 401".
          typeof b?.detail === 'string'
          ? b.detail
          : undefined;
  // A blank string is not a message. Trimmed, so a route answering `""`
  // falls through to the status instead of showing an empty box.
  const shown = message?.trim();
  return { error: shown ? shown : `API ${status}`, fieldErrors };
}
