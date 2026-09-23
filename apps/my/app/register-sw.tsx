'use client';

// Registers the service worker, and nothing else.
//
// Its own component because registration must happen in the browser and the
// layout is a server component. A failure is logged and otherwise ignored:
// without the worker the app behaves exactly as it did before, it just shows
// the browser's own error page instead of ours when the signal goes.
//
// Rendered for signed-out visitors too, on purpose — someone installs the app
// from the sign-in screen, and a worker that only registers after sign-in
// would miss the install.

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
      console.warn('[offline] service worker registration failed', e);
    });
  }, []);

  return null;
}
