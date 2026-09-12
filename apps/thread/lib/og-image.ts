// Fetching somebody else's picture into a link-preview card.
//
// The cards under app/[organiserSlug]/ put a thread's cover and a workspace's
// logo into an ImageResponse. Satori will fetch a remote `src` on its own,
// and that is the version of this that must not ship: a slow or missing
// image makes the whole card throw, and a card that throws is a 500 where a
// scraper expected a picture — so one broken upload would take the preview
// off every link that workspace has ever shared, including the ones that
// still had a perfectly good cover.
//
// So the fetch happens HERE, with a deadline and a size cap, and every
// failure comes back as null for the card to lay out around. A preview
// without the cover is a smaller loss than no preview at all.

/** Long enough for a cold Supabase object, short enough that a scraper with
 *  its own timeout still gets a card. */
const DEADLINE_MS = 2500;
/** Past this, the base64 inflation costs more than the picture is worth on a
 *  1200×630 card that will be shown at about 400px wide in a chat. */
const MAX_BYTES = 4_000_000;

/** A `data:` URI satori can lay out, or null if anything at all went wrong. */
export async function remoteImage(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(DEADLINE_MS),
      cache: 'force-cache',
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    // Only what satori can actually rasterise. An HTML error page served with
    // a 200 is the common shape of "the bucket moved", and it would otherwise
    // reach the renderer as a broken image.
    if (!/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/i.test(type)) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return null;
    return `data:${type};base64,${Buffer.from(buf).toString('base64')}`;
  } catch {
    // Timeout, DNS, TLS, a deleted object — all the same answer to the card.
    return null;
  }
}

/** One line of dates, in the thread's own terms. Date-only on purpose: a
 *  preview card is not a schedule, and a time without a timezone is a lie. */
export function dateLine(startsOn: string | null, endsOn: string | null): string | null {
  if (!startsOn && !endsOn) return null;
  const fmt = (d: string) =>
    new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(new Date(d));
  if (startsOn && endsOn && startsOn !== endsOn) return `${fmt(startsOn)} — ${fmt(endsOn)}`;
  return fmt((startsOn ?? endsOn)!);
}
