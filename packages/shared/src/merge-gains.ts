// "What would this record gain?" — including the answer "I don't know".
//
// The duplicates screen tells you which fields each record would gain if you
// merged into it. On 2026-10-04 it told a lie instead: both records claimed to
// gain nothing while one plainly had a phone and a city the other lacked. The
// API carrying the preview had not been deployed yet, so the field was simply
// absent, and the page rendered absent as the sentence "Gains nothing — the
// other record has nothing this one is missing."
//
// Two states were written where there are three:
//
//   list    — the preview answered, and these fields move.
//   none    — the preview answered, and nothing moves. A real finding: it
//             means the other record is the fuller one.
//   unknown — nobody answered. An older API without the field, a preview that
//             failed. The honest rendering is SILENCE; any sentence here is
//             invented.
//
// `none` and `unknown` look identical in a falsy check and mean opposite
// things, which is the whole bug. This lives in @thefibre/shared and not in
// the page because apps/web has no test runner — a test written beside that
// component would never run, and the distinction is exactly the kind that
// rots quietly.

export type MergeGains =
  | { kind: 'unknown' }
  | { kind: 'none' }
  | { kind: 'list'; fields: string[] };

/**
 * @param gains the API's per-record list: absent when it could not be
 *   computed, `[]` when it was computed and nothing moves.
 */
export function mergeGains(gains: string[] | null | undefined): MergeGains {
  if (gains === null || gains === undefined) return { kind: 'unknown' };
  if (gains.length === 0) return { kind: 'none' };
  return { kind: 'list', fields: gains };
}
