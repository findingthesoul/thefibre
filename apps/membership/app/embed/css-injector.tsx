'use client';

// Shim — the real component lives in @thefibre/shared/ui/embed-frame
// (components-first). Bound to Membership's namespace and style id; it
// still posts `membership-embed:ready` and receives `membership-embed:css`.

import { EmbedCssReceiver } from '@thefibre/shared/ui/embed-frame';

export function CssInjector() {
  return <EmbedCssReceiver ns="membership-embed" styleId="me-custom-css" />;
}
