// The portal's own user-facing version, independent of the monorepo cadence
// (CLAUDE.md "Version bumps"). 0.5.0 is details you can actually change;
// 0.4.0 was Purchases and Memberships, 0.3.0 Next as a timeline, 0.2.0 the
// four-destination shell, 0.1.0 the single grouped page.
//
// It lives here rather than in the layout because Next allows a route file
// to export only its own reserved names — an extra export from layout.tsx is
// a type error, not a style opinion.
export const VERSION = '0.6.0';
