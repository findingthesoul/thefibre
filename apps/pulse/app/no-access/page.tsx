import { createNoAccessPage, noAccessContextFromShell } from '@thefibre/shared/no-access';
import { loadAppShell } from '@thefibre/shared/app-shell';
import { apiFetch } from '@/lib/api';
import { Switch } from './switch';

// Context comes from the same loader the (app) layout used to send someone
// here, so the page names the workspace it is talking about and offers the
// ones where Pulse is on (Sjoerd, 2026-09-27).
export default createNoAccessPage({
  appName: 'Pulse',
  fibreUrl: process.env.NEXT_PUBLIC_FIBRE_URL,
  portalUrl: process.env.NEXT_PUBLIC_MY_URL,
  context: async () => noAccessContextFromShell(await loadAppShell({ apiFetch, appSlug: 'fibre-pulse' })),
  Switch,
});
