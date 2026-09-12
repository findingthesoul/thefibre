// The link-preview card for a public owner page — a workspace, a team or an
// organiser at /{owner}.
//
// Same rule as the thread card next door: their logo, their name, their
// header image if Settings → Website gave them one, and The Thread's
// wordmark small at the bottom. What differs is that an owner page has no
// single cover and no dates, so the card says what is actually useful about
// it — how many public threads are on it right now.

import { ImageResponse } from 'next/og';
import { EMAIL_BRAND } from '@thefibre/shared';
import { publicFetch } from '@/lib/public-api';
import { remoteImage } from '@/lib/og-image';

export const alt = 'Public page';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

type Payload = {
  organiser: { slug: string; display_name: string | null; bio: string | null; photo_url: string | null };
  threads: unknown[];
  site?: { name: string | null; logo_url: string | null; hero_url: string | null; headline: string | null } | null;
};

const INK = '#1a1a2e';
const MUTED = '#6b6b7b';

export default async function Image({
  params,
}: {
  params: Promise<{ organiserSlug: string }>;
}) {
  const { organiserSlug } = await params;
  const data = await publicFetch<Payload>(
    `/api/v1/thread/public/organiser/${organiserSlug}`,
  ).catch(() => null);

  const name = data?.site?.name ?? data?.organiser.display_name ?? organiserSlug;
  const headline = data?.site?.headline ?? data?.organiser.bio ?? null;
  const count = data?.threads.length ?? 0;

  const [hero, logo, wordmark] = await Promise.all([
    remoteImage(data?.site?.hero_url),
    remoteImage(data?.site?.logo_url ?? data?.organiser.photo_url),
    remoteImage(EMAIL_BRAND.logoUrl),
  ]);

  const shownHeadline =
    headline && headline.length > 150 ? `${headline.slice(0, 148).trimEnd()}…` : headline;
  // Same two ladders as the thread card: the panel is half the frame with a
  // header image and the whole of it without.
  const nameSize = hero
    ? name.length > 34
      ? 46
      : name.length > 20
        ? 58
        : 70
    : name.length > 34
      ? 62
      : name.length > 20
        ? 80
        : 96;

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
        {!hero && (
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
            width: hero ? 664 : 1200,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 64,
            fontFamily: 'sans-serif',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            {logo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt=""
                style={{ maxHeight: 72, maxWidth: 340, objectFit: 'contain' }}
              />
            )}
            <div
              style={{
                fontSize: nameSize,
                fontWeight: 700,
                color: INK,
                lineHeight: 1.1,
                letterSpacing: -1,
              }}
            >
              {name}
            </div>
            {shownHeadline && (
              <div style={{ fontSize: 26, color: MUTED, lineHeight: 1.4 }}>{shownHeadline}</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {count > 0 && (
              <div style={{ fontSize: 26, color: INK }}>
                {count === 1 ? '1 event open' : `${count} events open`}
              </div>
            )}
            {wordmark && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={wordmark} alt="" style={{ height: 26, objectFit: 'contain' }} />
            )}
          </div>
        </div>

        {hero && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={hero} alt="" style={{ width: 536, height: 630, objectFit: 'cover' }} />
        )}
      </div>
    ),
    size,
  );
}
