import { createNoAccessPage } from '@thefibre/shared/no-access';
import { APPS } from '@thefibre/shared';

// The name comes from branding for the same reason the home-screen icon's
// does: a rename must not leave one page still saying the old word.
export default createNoAccessPage({
  appName: APPS['fibre-sales'].name,
  fibreUrl: process.env.NEXT_PUBLIC_FIBRE_URL,
});
