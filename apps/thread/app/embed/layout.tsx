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

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="thread-embed-root" className="bg-surface text-ink p-3">
      <script dangerouslySetInnerHTML={{ __html: FORCE_LIGHT }} />
      <HeightReporter />
      <CssInjector />
      {children}
    </div>
  );
}
