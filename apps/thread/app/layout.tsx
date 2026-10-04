import './globals.css';
import { appMetadata, createRootLayout, APP_VIEWPORT } from '@thefibre/shared/root-layout';

export const metadata = appMetadata('the-thread', process.env);

export default createRootLayout({ vercelEnv: process.env.VERCEL_ENV });

export const viewport = APP_VIEWPORT;
