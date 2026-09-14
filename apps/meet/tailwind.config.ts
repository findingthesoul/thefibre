import type { Config } from 'tailwindcss';
import { fibrePreset } from '@thefibre/shared/design/tailwind-preset';

// Theme, colour roles and the CSS variables behind them come from ONE place:
// packages/shared/src/design (see docs/brand-design.md). Do not add colours
// here — add a role to design/tokens.ts, and every app gets it.
export default {
  presets: [fibrePreset as unknown as Config],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    // Shared UI carries Tailwind classes — without this glob the purge step
    // drops them in production builds.
    '../../packages/shared/src/**/*.{ts,tsx}',
  ],
} satisfies Config;
