import { createNoAccessPage } from '@thefibre/shared/no-access';

export default createNoAccessPage({
  appName: 'Meet',
  fibreUrl: process.env.NEXT_PUBLIC_FIBRE_URL,
});
