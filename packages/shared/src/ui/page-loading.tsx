// The instant a page is on its way — the skeleton every app's (app)/loading.tsx
// re-exports. Until 2026-09-17 no app had a loading boundary at all, so a
// menu click showed the old page, unchanged, for the ~0.8 s the next one took
// to render on the server; the interface read as stuck. With a boundary, the
// click paints this at once and Next streams the page in behind it.
//
// Deliberately shape-only and colour-token-only (docs/brand-design.md): a
// header line, a paragraph line, and three card-height blocks, in the sunken
// surface tone, pulsing. No text, so there is nothing to translate and
// nothing that could contradict the page that replaces it.

export function PageLoading() {
  const block = 'animate-pulse rounded-lg bg-surface-sunken';
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6" aria-busy="true" aria-live="polite">
      <div className={`${block} h-7 w-48`} />
      <div className={`${block} mt-3 h-4 w-80 max-w-full`} />
      <div className="mt-8 space-y-3">
        <div className={`${block} h-16 w-full`} />
        <div className={`${block} h-16 w-full`} />
        <div className={`${block} h-16 w-full`} />
      </div>
    </div>
  );
}

export default PageLoading;
