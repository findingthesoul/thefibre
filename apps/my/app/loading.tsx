// my.thread had no loading boundary. Every other app got one on 2026-09-17
// and this one was missed — so a tab click here showed the OLD page,
// unchanged, for as long as the next one took to render on the server, and
// the interface read as stuck.
//
// Sjoerd: *"Why does the loading between elements in my.thread take so long?
// Can this be optimised?"* — and he wondered whether it was his internet. It
// was not. Measured, the pages are slow (the You tab makes six server calls
// in a queue); but the thing that made it feel broken rather than slow is
// that NOTHING ACKNOWLEDGED THE CLICK.
//
// ONE FILE AT THE ROOT covers every tab, because a `loading.tsx` is the
// Suspense fallback for everything below its segment. The layout is not
// re-rendered on a tab-to-tab navigation, so the boundary does what it is
// here for: the skeleton paints at once and Next streams the page in behind.
export { default } from '@thefibre/shared/ui/page-loading';
