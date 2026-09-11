'use client';

// Shim over the shared component — the implementation lives in
// packages/shared/src/ui/app-switcher.tsx (single source of truth; per-app
// copies retired 2026-09-05, component-inventory Phase 1). next/link is bound
// here so the shared package keeps no Next.js dependency.
import Link from 'next/link';
import { createAppSwitcher } from '@thefibre/shared/ui/app-switcher';

export type { AppEntry } from '@thefibre/shared/ui/app-switcher';
export const AppSwitcher = createAppSwitcher(Link);
