// Whether a meeting type may use Zoom, from what /meet/me says.
//
// One function for both editor pages (new and edit), because they each read
// `zoom_connected` on their own until 2026-10-16 — and both forgot that a
// connected account is useless on a platform where Zoom is not configured,
// which is production while the Marketplace app is in review. A host could
// pick Zoom and every booking confirmed with no link.

export type ZoomState = 'ok' | 'not_configured' | 'not_connected' | 'failing';

export function zoomState(me: {
  zoom_configured?: boolean;
  zoom_connected?: boolean;
  zoom_refresh_failed_at?: string | null;
} | null): ZoomState {
  // An older API omits the field; only an explicit false means "not here".
  if (me?.zoom_configured === false) return 'not_configured';
  if (!me?.zoom_connected) return 'not_connected';
  if (me.zoom_refresh_failed_at) return 'failing';
  return 'ok';
}
