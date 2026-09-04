// Shim over the shared component — the implementation lives in
// packages/shared/src/ui/button.tsx (single source of truth; per-app copies
// retired 2026-09-05, component-inventory Phase 1). next/link is bound here
// so the shared package keeps no Next.js dependency.
import Link from 'next/link';
import type { ComponentProps } from 'react';
import { createButtonLink } from '@thefibre/shared/ui/button';

export { Button } from '@thefibre/shared/ui/button';
export const ButtonLink = createButtonLink<ComponentProps<typeof Link>>(Link);
