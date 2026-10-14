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

// ---------------------------------------------------------------------------
// ZOD'S WORDS ARE NOT A PERSON'S WORDS.
//
// A validation failure arrives as `{ formErrors: [], fieldErrors: { … } }`,
// and twelve of the thirteen old copies of `unwrap` put that object where a
// sentence belonged. Sjoerd saw this in a red box on staging:
//
//   API 400: {"formErrors":[],"fieldErrors":{"last_name":
//            ["String must contain at least 1 character(s)"]}}
//
// and asked for "better warnings". JSON in front of a person is not a
// warning; it is a stack trace wearing a coat.
//
// These turn it into something a person can act on. They live here, beside
// `apiErrorResult`, so every app gets it from one place rather than thirteen
// apps each writing a slightly different sentence.
// ---------------------------------------------------------------------------

/** `last_name` → `Last name`, `taxId` → `Tax id`.
 *
 *  A caller with better words passes a label map; this is what happens when
 *  nobody has. It is deliberately plain: a wrong guess at a friendly name is
 *  worse than the field's own, because the person then has to map it back to
 *  the box they typed in. */
export function fieldLabel(key: string, labels?: Record<string, string>): string {
  const given = labels?.[key];
  if (given) return given;
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}

/** One field's first complaint, said in words.
 *
 *  Zod's defaults are written for whoever wrote the schema. The three
 *  translated here are the three a form actually produces; anything else
 *  keeps zod's own sentence after the label, because a message we do not
 *  recognise is still better than one we invent. */
export function humanFieldError(
  key: string,
  messages: string[] | undefined,
  labels?: Record<string, string>,
): string | null {
  const first = (messages ?? []).find((m) => typeof m === 'string' && m.trim());
  if (!first) return null;
  const label = fieldLabel(key, labels);
  // "String must contain at least 1 character(s)", "Required", and zod 4's
  // "Too small: expected string to have >=1 characters".
  if (/required/i.test(first) || /at least 1 char/i.test(first) || />=\s*1 char/i.test(first)) {
    return `${label} is required.`;
  }
  if (/at most|too big|too long|<=\s*\d+ char/i.test(first)) return `${label} is too long.`;
  if (/email/i.test(first)) return `${label} is not a valid email address.`;
  return `${label}: ${first}`;
}

/** Every field complaint, in the order the API listed them. */
export function humanFieldErrors(
  fieldErrors: Record<string, string[]> | undefined,
  labels?: Record<string, string>,
): string[] {
  return Object.entries(fieldErrors ?? {})
    .map(([key, messages]) => humanFieldError(key, messages, labels))
    .filter((m): m is string => !!m);
}

/** `apiErrorResult`, with the field errors turned into a sentence.
 *
 *  Use this from a form. The plain `apiErrorResult` stays for callers with no
 *  fields to name — and the API's own sentence still wins when it gave one,
 *  because it knows things this does not. */
export function formErrorResult(
  status: number,
  body: unknown,
  labels?: Record<string, string>,
): ActionResult {
  const base = apiErrorResult(status, body);
  const human = humanFieldErrors(base.fieldErrors, labels);
  if (!human.length) return base;
  // A STATUS IS NOT A MESSAGE. When the API gave only field errors, the base
  // result falls back to "API 400" — exactly the string this exists to
  // replace. When it gave a real sentence, that sentence leads and the field
  // list follows it.
  const generic = /^API \d+$/.test(base.error ?? '');
  const lead = generic ? '' : `${base.error} `;
  return { ...base, error: `${lead}${human.join(' ')}`.trim() };
}
