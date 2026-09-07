// The default footer — one implementation for every public surface,
// living in @thefibre/shared (ui/marketing-footer). No snap alignment:
// the Home page's last card also opts out of the magnet, so the page
// tail (invitation + footer) scrolls freely — reachable downward AND
// escapable upward (snap-end here trapped the scroll at the bottom).

import { MarketingFooter } from '@thefibre/shared/ui/marketing-footer';

export function SiteFooter() {
  return <MarketingFooter />;
}
