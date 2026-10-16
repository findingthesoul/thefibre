// The You page's tab names, in a PLAIN module. page.tsx is a server component
// and reads this list to choose the tab; a value imported from a 'use client'
// module reaches the server as a client reference, not the array, so keeping
// it in you-tabs.tsx made every /you render throw (v1.248.2, staging).
export const YOU_TABS = ['profile', 'memberships', 'billing', 'notifications', 'privacy'] as const;
export type YouTab = (typeof YOU_TABS)[number];
