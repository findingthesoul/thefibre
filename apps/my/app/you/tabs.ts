// The You page's tab names, in a PLAIN module. page.tsx is a server component
// and reads this list to choose the tab; a value imported from a 'use client'
// module reaches the server as a client reference, not the array, so keeping
// it in you-tabs.tsx made every /you render throw (v1.248.2, staging).
// Memberships and Billing left on 2026-10-16: they repeated the sidebar's
// Memberships and Purchases pages (page.tsx redirects their old links).
export const YOU_TABS = ['profile', 'notifications', 'privacy'] as const;
export type YouTab = (typeof YOU_TABS)[number];
