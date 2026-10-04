import type { Metadata } from 'next';
import { HeightReporter } from './height-reporter';
import { CssInjector } from './css-injector';

// Embed pages render inside <iframe>s on third-party sites (Webflow etc.).
// No sidebar, no topbar, no auth — just the content, tight padding, and a
// height reporter so the parent page can size the iframe to fit.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Undo the root ThemeScript: embeds always render light — we can't know the
// host site's palette, and `theme=light` is the only supported value for now.
const FORCE_LIGHT = "document.documentElement.classList.remove('dark');";

// …and undo the staging bar, which the root layout renders on every
// non-production deployment. Everywhere else it is the point: you should know
// which stack you are looking at. An embed is different — it is a fragment
// inside somebody else's page, sized by the height reporter, and a 5px blue
// line across the top of it reads as a defect in THEIR design rather than a
// note about ours. The audience here is the customer's visitor, not us.
const HIDE_STAGING_BAR = '[data-environment-bar]{display:none!important}';

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="thread-embed-root" className="bg-surface text-ink p-3">
      <style dangerouslySetInnerHTML={{ __html: HIDE_STAGING_BAR }} />
      <script dangerouslySetInnerHTML={{ __html: FORCE_LIGHT }} />
      <HeightReporter />
      <CssInjector />
      {children}
    </div>
  );
}
