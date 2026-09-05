'use client';

// Shim — the real component lives in @thefibre/shared/ui/embed-frame
// (components-first). Bound to Membership's namespace and root id; the
// posted message type stays `membership-embed:height`.

import { EmbedHeightReporter } from '@thefibre/shared/ui/embed-frame';

export function HeightReporter() {
  return <EmbedHeightReporter ns="membership-embed" rootId="membership-embed-root" />;
}
