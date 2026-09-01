import { Hono } from 'hono';
import { handleUpload } from '../lib/uploads.js';

export const uploadRoutes = new Hono();

// POST /api/v1/uploads — an image, from any app, for any picture the platform
// stores: a profile photo, a workspace logo, a cover.
uploadRoutes.post('/', handleUpload);
