// The tab names, in a PLAIN module: page.tsx is a server component and picks
// the tab from this list. A value imported from a 'use client' module reaches
// the server as a client reference, not the array, so reading it from
// accounts-client.tsx made the page throw on every render (v1.250.0 — the
// same mistake as my.thread's You tabs in v1.248.2).
export const GA_STATUSES = ['requested', 'created', 'declined', 'all'] as const;
export type GaStatus = (typeof GA_STATUSES)[number];
