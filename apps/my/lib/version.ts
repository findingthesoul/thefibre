// The portal's own user-facing version, independent of the monorepo cadence
// (CLAUDE.md "Version bumps"). 0.2.0 is the four-destination shell; 0.1.0
// was the single grouped page it replaced.
//
// It lives here rather than in the layout because Next allows a route file
// to export only its own reserved names — an extra export from layout.tsx is
// a type error, not a style opinion.
export const VERSION = '0.2.0';
