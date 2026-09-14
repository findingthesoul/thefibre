'use client';

// Meet's binding of the shared browser-side asset uploader. The
// implementation lives in packages/shared/src/upload.ts; this file supplies
// the upload route, the app id and how the browser client reads the session.

import { createAssetUploader } from '@thefibre/shared/upload';
import { browserSupabase } from './supabase/client';

export const uploadAsset = createAssetUploader({
  appId: 'fibre-meet',
  path: '/api/v1/meet/uploads',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    browserSupabase().auth.getSession().then((r) => r.data.session?.access_token),
});
