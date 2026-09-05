'use client';

// Thin shim binding the shared embed-frame component to the Thread's
// namespace/ids — the implementation lives in
// packages/shared/src/ui/embed-frame.tsx (components-first rule).
import { EmbedHeightReporter } from '@thefibre/shared/ui/embed-frame';

export function HeightReporter() {
  return <EmbedHeightReporter ns="thread-embed" rootId="thread-embed-root" />;
}
