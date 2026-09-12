// The link-preview card — what WhatsApp, Slack, iMessage and LinkedIn show
// when someone pastes thethread.app.
//
// Sjoerd, 2026-09-12, from a phone: "when I copy and paste the link, there is
// an image. The image of the thread is an old one. Not the new one." He was
// right. This file used to DRAW an approximation of the brand — a yellow blob
// and a wavy line in hand-written SVG paths, with "The Thread" set in the
// renderer's default sans. None of that had been true since the site was
// rebranded on 2026-09-07: the real wordmark is a handwritten mark in
// public/logo-the-thread.svg, the payoff is "Tools to facilitate change.",
// and the design language is the painted shapes in public/shapes/.
//
// THE RULE THIS FILE NOW FOLLOWS: read the same files the site renders. A
// card that redraws the brand from memory is a copy that goes stale silently,
// which is exactly how this one did — nothing failed, nothing warned, and the
// only way to notice was to paste the link into a chat and look. Replacing
// the logo now updates the preview with it.

import { ImageResponse } from 'next/og';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const alt = 'The Thread — tools to facilitate change';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Read at module scope, which for a prerendered OG route means BUILD time,
 *  where cwd is the app directory (Next's own documented pattern for fonts
 *  and assets in ImageResponse). */
const asDataUri = (path: string, mime: string) =>
  `data:${mime};base64,${readFileSync(join(process.cwd(), path)).toString('base64')}`;

const WORDMARK = asDataUri('public/logo-the-thread.svg', 'image/svg+xml');
const SHAPE = asDataUri('public/shapes/yellow-egg.png', 'image/png');

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        {/* One thread, fallen on a long white paper (the site's own idiom).
            Written for this card rather than lifted from app/page.tsx: the
            hero's segment runs top-to-bottom down a tall screen, and a
            landscape card needs a line that enters left and leaves right.
            It stays BELOW the wordmark on purpose — the first draft ran the
            line straight through "the thread" and put a curl over the payoff,
            which no amount of being on-brand makes legible. */}
        <svg
          width="1200"
          height="630"
          viewBox="0 0 1200 630"
          style={{ position: 'absolute', left: 0, top: 0 }}
        >
          <path
            d="M-20 452 C140 424 300 476 460 492 C600 506 690 470 760 494 C838 520 820 592 752 578 C690 565 736 508 852 512 C990 517 1130 545 1230 582"
            fill="none"
            stroke="#1a1a2e"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.85"
          />
        </svg>

        {/* A real piece of the collage, bleeding off the right edge — the
            painted shapes ARE the brand now, and a white card with nothing
            but black type on it reads as a broken image in a chat thread.
            Off the side rather than the corner, so it stays an egg rather
            than becoming a half-disc. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={SHAPE}
          alt=""
          width={286}
          height={330}
          style={{ position: 'absolute', right: -84, top: 34, transform: 'rotate(12deg)' }}
        />

        {/* The hero, as the hero actually is: the wordmark, then the payoff in
            letterspaced caps under it. */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 26,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={WORDMARK} alt="The Thread" width={640} height={156} />
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              color: '#1a1a2e',
              letterSpacing: 6,
              textTransform: 'uppercase',
            }}
          >
            Tools to facilitate change.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
