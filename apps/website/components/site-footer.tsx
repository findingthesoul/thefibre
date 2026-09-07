// The default footer — one implementation for every public surface,
// living in @thefibre/shared (ui/marketing-footer). This wrapper only
// adds the snap-end stop the Home page's scroll magnet needs.

import { MarketingFooter } from '@thefibre/shared/ui/marketing-footer';

export function SiteFooter() {
  return <MarketingFooter className="snap-end" />;
}
