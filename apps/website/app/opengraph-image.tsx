// The OG card (closes the P5 gap for this surface): white ground, one
// yellow cut, the wordmark line and the payoff. Generated at build/request
// time by Next's ImageResponse — no personal data involved.

import { ImageResponse } from 'next/og';

export const alt = 'The Thread — for weaving the social fabric';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: '#ffffff',
          padding: 72,
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        <svg
          width="420"
          height="588"
          viewBox="0 0 100 140"
          style={{ position: 'absolute', right: 48, top: -40, transform: 'rotate(8deg)' }}
        >
          <path
            fill="#ffdd00"
            d="M50 4 C62 4 70 10 68 20 C66 28 60 32 62 40 C66 58 88 66 90 92 C92 122 74 136 50 136 C26 136 8 122 10 92 C12 66 34 58 38 40 C40 32 34 28 32 20 C30 10 38 4 50 4 Z"
          />
        </svg>
        <svg
          width="1100"
          height="240"
          viewBox="0 0 1100 240"
          style={{ position: 'absolute', left: 0, top: 180 }}
        >
          <path
            d="M0 200 C220 120 380 210 540 140 C700 70 860 160 1100 40"
            fill="none"
            stroke="#1a1a2e"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 84, fontWeight: 700, color: '#1a1a2e', letterSpacing: -2 }}>
            The Thread
          </div>
          <div style={{ fontSize: 34, color: '#555555', marginTop: 8 }}>
            For weaving the social fabric.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
