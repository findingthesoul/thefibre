// The portal's own user-facing version, independent of the monorepo cadence
// (CLAUDE.md "Version bumps"). 0.3.0 is Next as a date-ordered timeline;
// 0.2.0 was the four-destination shell; 0.1.0 the single grouped page.
//
// It lives here rather than in the layout because Next allows a route file
// to export only its own reserved names — an extra export from layout.tsx is
// a type error, not a style opinion.
export const VERSION = '0.3.0';
