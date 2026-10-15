import { describe, expect, it } from 'vitest';
import { zoomState } from './zoom-state';

describe('zoomState', () => {
  it('is not usable where Zoom is not configured, even with an account connected', () => {
    // Production while the Marketplace app is in review: the case that let a
    // host pick Zoom and every booking confirm with no link.
    expect(zoomState({ zoom_configured: false, zoom_connected: true })).toBe('not_configured');
  });

  it('needs a connected account', () => {
    expect(zoomState({ zoom_configured: true, zoom_connected: false })).toBe('not_connected');
    expect(zoomState(null)).toBe('not_connected');
  });

  it('reports a connection whose refresh has been failing', () => {
    expect(
      zoomState({ zoom_configured: true, zoom_connected: true, zoom_refresh_failed_at: '2026-10-16T09:00:00Z' }),
    ).toBe('failing');
  });

  it('is usable when configured, connected and refreshing', () => {
    expect(zoomState({ zoom_configured: true, zoom_connected: true, zoom_refresh_failed_at: null })).toBe('ok');
  });

  it('treats a missing zoom_configured (older API) as configured', () => {
    expect(zoomState({ zoom_connected: true })).toBe('ok');
  });
});
