// The portal's own user-facing version, independent of the monorepo cadence
// (CLAUDE.md "Version bumps"). 0.11.0 is the calendar you can subscribe to,
// and the way back out; 0.10.0 was the offline ticket under a logo, 0.5.0
// details you can actually change; 0.4.0 was Purchases and Memberships,
// 0.3.0 Next as a timeline, 0.2.0 the four-destination shell, 0.1.0 the
// single grouped page.
//
// It sat at 0.10.5 through five releases of portal features — a footer
// telling people they were using software without the feature on the screen
// in front of them. scripts/check-app-versions.mjs now says so at release
// time, because nothing stamps this file and "bumped when somebody
// remembers" is not a mechanism.
//
// It lives here rather than in the layout because Next allows a route file
// to export only its own reserved names — an extra export from layout.tsx is
// a type error, not a style opinion.
export const VERSION = '0.11.0';
