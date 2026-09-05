import { createNoAccessPage } from '@thefibre/shared/no-access';

export default createNoAccessPage({
  appName: 'Pulse',
  fibreUrl: process.env.NEXT_PUBLIC_FIBRE_URL,
});
