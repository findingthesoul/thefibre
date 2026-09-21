// The two pieces the note composer and the meeting write-up both need.
//
// They lived in people/[id]/notes.tsx, which is a large 'use client' module;
// importing them from Today would have pulled the whole composer into that
// page's bundle. More to the point, FIELD_ROW is a LOOK, and two copies of a
// look is how the two boxes start disagreeing — which is the one thing Sjoerd
// has asked us not to let happen again ("one single point of truth").

/**
 * The composer's first row: what happened, when, and whose. One row on every
 * width — equal shares, each allowed to shrink (min-w-0) so a long team name
 * truncates instead of wrapping the row, and the gap closes up on a phone.
 * The date field inside it is `compact`, so its year and inline clear step
 * aside below `sm`.
 */
export const FIELD_ROW = 'flex gap-2 sm:gap-4 [&>*]:min-w-0 [&>*]:flex-1';

/** "YYYY-MM-DDTHH:mm" in local time — the shape DateTimeField holds. */
export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
