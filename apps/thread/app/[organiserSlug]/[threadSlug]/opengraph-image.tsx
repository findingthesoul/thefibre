// The link-preview card for a public thread.
//
// Sjoerd, 2026-09-12: "Solve that. Incl. the logo of the organiser/workspace."
// Until now an organiser pasting their own event into WhatsApp got a bare
// grey card with the words "The Thread" on it — the app's root metadata, and
// nothing about their event at all. Every public thread already has a cover
// image, a title and dates, and every workspace already has a logo on its
// outgoing email. All of it was sitting there unused.
//
// WHOSE CARD IS IT: the workspace's, not ours. Their logo is at the top and
// their cover fills half the frame; The Thread's wordmark sits small at the
// bottom, the size of a printer's mark. An organiser sharing their event is
// not advertising us.
//
// The layout keeps everything on WHITE rather than over the photograph. A
// logo is somebody else's file — it can be black, white, or a transparent
// PNG that vanishes on either — and a scrim that works for one breaks the
// next. White is the only ground that takes them all, and it leaves the
// cover doing the one job it is good at: colour, at 400px wide, in a list of
// grey chat bubbles.

import { ImageResponse } from 'next/og';
import { EMAIL_BRAND } from '@thefibre/shared';
import { publicFetch } from '@/lib/public-api';
import { remoteImage, dateLine } from '@/lib/og-image';

export const alt = 'Event';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Payload = {
  organiser: { slug: string; display_name: string | null; photo_url: string | null };
  site?: { name: string | null; logo_url: string | null } | null;
  thread: {
    slug: string;
    cover_url: string | null;
    program: { title: string; starts_on: string | null; ends_on: string | null } | null;
  };
};

const INK = '#1a1a2e';
const MUTED = '#6b6b7b';

export default async function Image({
  params,
}: {
  params: Promise<{ organiserSlug: string; threadSlug: string }>;
}) {
  const { organiserSlug, threadSlug } = await params;

  // Anonymous on purpose. The page itself forwards a signed-in organiser's
  // token so they can preview a draft; a preview CARD must not, or a scraper
  // would be one 404 away from publishing an unpublished event.
  const data = await publicFetch<Payload>(
    `/api/v1/thread/public/organiser/${organiserSlug}/thread/${threadSlug}`,
  ).catch(() => null);

  const program = data?.thread.program ?? null;
  const title = program?.title ?? 'Event';
  const owner = data?.site?.name ?? data?.organiser.display_name ?? organiserSlug;
  const dates = dateLine(program?.starts_on ?? null, program?.ends_on ?? null);

  const [cover, logo, wordmark] = await Promise.all([
    remoteImage(data?.thread.cover_url),
    remoteImage(data?.site?.logo_url ?? data?.organiser.photo_url),
    remoteImage(EMAIL_BRAND.logoUrl),
  ]);

  // Satori has no line-clamp, so the title is cut here. Long titles are
  // common — a conference name plus a subtitle — and a card that overflows
  // pushes the dates off the bottom edge silently.
  const shown = title.length > 90 ? `${title.slice(0, 88).trimEnd()}…` : title;
  // Two ladders, because the panel is half the card with a cover and all of
  // it without. A title set for the narrow panel and then shown full width
  // looks like a mistake rather than a choice — the first version left two
  // thirds of the card empty.
  const titleSize = cover
    ? shown.length > 58
      ? 44
      : shown.length > 32
        ? 54
        : 64
    : shown.length > 58
      ? 64
      : shown.length > 32
        ? 78
        : 92;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#ffffff',
          position: 'relative',
        }}
      >
        {/* With no cover there is nothing but type on a white field, so the
            site's own fallen thread runs through the empty half. Drawn here
            rather than loaded: it is four control points, and an asset would
            be a second copy of a line that lives in apps/website. */}
        {!cover && (
          <svg
            width="1200"
            height="630"
            viewBox="0 0 1200 630"
            style={{ position: 'absolute', left: 0, top: 0 }}
          >
            <path
              d="M760 -20 C742 120 820 210 900 268 C982 328 1010 430 940 470 C878 506 840 430 906 404 C1000 366 1130 430 1216 520"
              fill="none"
              stroke={INK}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
        )}
        <div
          style={{
            width: cover ? 664 : 1200,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 64,
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Theirs, first. A logo is given a box and told to fit inside
                it — a wide wordmark and a square avatar are both "the logo"
                and must not be stretched into each other's shape. */}
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                style={{ maxHeight: 64, maxWidth: 320, objectFit: 'contain' }}
              />
            ) : (
              <div style={{ fontSize: 26, fontWeight: 700, color: INK, letterSpacing: 1 }}>
                {owner}
              </div>
            )}
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 700,
                color: INK,
                lineHeight: 1.1,
                letterSpacing: -1,
              }}
            >
              {shown}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {dates && <div style={{ fontSize: 28, color: MUTED }}>{dates}</div>}
            {/* Ours, last and small. The owner is NOT named again here —
                their logo is already at the top, and on a wordmark logo
                (soul.com's is literally the words) it read twice. */}
            {wordmark && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wordmark} alt="" style={{ height: 26, objectFit: 'contain' }} />
            )}
          </div>
        </div>

        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt=""
            style={{ width: 536, height: 630, objectFit: 'cover' }}
          />
        )}
      </div>
    ),
    size,
  );
}
