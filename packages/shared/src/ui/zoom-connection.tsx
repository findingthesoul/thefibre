'use client';

// The Zoom connection card — now a thin wrapper over the provider-agnostic
// `ProviderConnectionCard`, which is this file's former body with the product
// name lifted out (see ui/provider-connection.tsx for why).
//
// Kept as its own export so no call site had to change when Teams needed the
// same card: apps/web and apps/meet both import `ZoomConnectionCard`, and a
// rename would have been churn in files this change has no business touching.
//
// The look is Meet's card (apps/meet/.../integrations/zoom.tsx), which still
// has its own copy; port it to this when next touched.

import {
  ProviderConnectionCard,
  type ProviderConnectionLabels,
} from './provider-connection.js';

/** @deprecated in spirit — prefer `ProviderConnectionLabels`. Kept so the
 *  existing imports of this name keep resolving. */
export type ZoomConnectionLabels = ProviderConnectionLabels;

export function ZoomConnectionCard(props: {
  connected: boolean;
  accountEmail: string | null;
  /** False when the server has no Zoom app credentials. */
  configured: boolean;
  /** `?zoom=` from the callback redirect. */
  statusParam: string | null;
  /** `?reason=` from the callback redirect. */
  reasonParam: string | null;
  labels: ZoomConnectionLabels;
  onStart: () => Promise<{ url?: string; error?: string }>;
  onDisconnect: () => Promise<{ ok: boolean; error?: string }>;
  onDisconnected?: () => void;
}) {
  return <ProviderConnectionCard name="Zoom" {...props} />;
}
