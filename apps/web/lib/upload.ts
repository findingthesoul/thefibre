'use client';

// The Fibre web app's binding of the shared browser uploader
// (@thefibre/shared/upload). The platform endpoint, not The Thread's:
// /api/v1/uploads takes a picture from any app (lib/uploads.ts on the API side).

import { createAssetUploader } from '@thefibre/shared/upload';
import { browserSupabase } from './supabase/client';

export const uploadAsset = createAssetUploader({
  appId: 'fibre-platform',
  path: '/api/v1/uploads',
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
  getAccessToken: async () =>
    browserSupabase().auth.getSession().then((r) => r.data.session?.access_token),
});
