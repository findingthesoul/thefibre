import { createNoAccessPage } from '@thefibre/shared/no-access';

export default createNoAccessPage({
  appName: 'Flow',
  fibreUrl: process.env.NEXT_PUBLIC_FIBRE_URL,
  portalUrl: process.env.NEXT_PUBLIC_MY_URL,
});
