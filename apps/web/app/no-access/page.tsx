import { createNoAccessPage } from '@thefibre/shared/no-access';

// The platform's own landing for a shell that could not load. For The Fibre
// hasAccess is always true, so (app)/layout.tsx only sends people here when
// /auth/me itself failed with something other than 401. fibreUrl is '' on
// purpose: this IS the platform, so the page's links stay same-origin
// (staging stays on staging) instead of the factory's production default.
export default createNoAccessPage({
  appName: 'The Fibre',
  fibreUrl: '',
  portalUrl: process.env.NEXT_PUBLIC_MY_URL,
});
