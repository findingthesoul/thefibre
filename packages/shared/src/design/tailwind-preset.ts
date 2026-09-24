// The Tailwind preset every in-family app builds with. One reference for the
// theme (colour roles and font) AND for the CSS variables behind it, so the
// palette cannot drift between nine configs again. See design/tokens.ts and
// docs/brand-design.md.
//
// In an app's tailwind.config.ts:
//
//   import { fibrePreset } from '@thefibre/shared/design/tailwind-preset';
//   export default { presets: [fibrePreset], content: [...] };
//
// The variables are injected with a plugin's addBase rather than copied into
// each globals.css, which is what keeps them single-sourced: an app's CSS file
// no longer contains a single colour value. An app that genuinely needs a
// different value overrides it in its own globals.css AFTER `@tailwind base`
// — and docs/brand-design.md says when that is allowed.
//
// Types are written out loosely on purpose: this package does not depend on
// tailwindcss, and the preset is plain data plus one function.

import { DARK, LIGHT, TOKEN_NAMES, cssVariables } from './tokens.js';

const rgbVar = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

type Styles = Record<string, Record<string, string>>;
type PluginApi = { addBase: (s: Styles) => void; addUtilities: (s: Styles) => void };

export const fibrePreset = {
  darkMode: 'class' as const,
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Inter', 'sans-serif'],
      },
      colors: {
        surface: {
          DEFAULT: rgbVar('surface'),
          sunken: rgbVar('surface-sunken'),
          raised: rgbVar('surface-raised'),
        },
        ink: {
          DEFAULT: rgbVar('ink'),
          subtle: rgbVar('ink-subtle'),
          muted: rgbVar('ink-muted'),
          inverse: rgbVar('ink-inverse'),
        },
        line: {
          DEFAULT: rgbVar('line'),
          strong: rgbVar('line-strong'),
        },
        accent: { DEFAULT: rgbVar('accent') },
        save: { DEFAULT: rgbVar('save') },
        booked: { DEFAULT: rgbVar('booked') },
        // A print role (the invoice PDF's foot band). Exposed here because a
        // token that Tailwind cannot see is a token half-added — which is
        // what tokens.test.ts caught the moment it was.
        paper: { DEFAULT: rgbVar('paper') },
      },
    },
  },
  plugins: [
    function fibreTokens({ addBase, addUtilities }: PluginApi) {
      addBase({
        ':root': cssVariables(LIGHT),
        '.dark': cssVariables(DARK),
        'html, body': { background: 'rgb(var(--surface))', color: 'rgb(var(--ink))' },
        html: { 'color-scheme': 'light' },
        '.dark html, html.dark': { 'color-scheme': 'dark' },
      });
      // The soft card shadow (Connections, Flow, Pulse). Moved here from three
      // globals.css copies. Softened 2026-07-02 — Sjoerd: "shadow too big, too
      // bulky, more subtle".
      addUtilities({
        '.shadow-card': {
          'box-shadow': '0 1px 2px rgba(15, 23, 42, 0.03), 0 6px 14px -10px rgba(15, 23, 42, 0.1)',
        },
        '.shadow-card-hover:hover': {
          'box-shadow': '0 1px 3px rgba(15, 23, 42, 0.05), 0 10px 22px -12px rgba(15, 23, 42, 0.16)',
        },
      });
    },
  ],
};

/** For tests and tooling: the token names the preset exposes. */
export const PRESET_TOKENS = TOKEN_NAMES;
