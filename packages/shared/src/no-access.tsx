// The "this account can't use this app yet" page — one factory instead of
// five byte-alike copies (component-inventory.md Phase 4; the five differed
// only by app name). Shared has no next/node dependency (house rule — see
// createSidebarShell's injection), so the env value is passed in by the
// app's own page file and links are plain <a> (they point at the platform
// origin, where next/link gives no client-nav anyway):
//
//   export default createNoAccessPage({
//     appName: 'Meet',
//     fibreUrl: process.env.NEXT_PUBLIC_FIBRE_URL,
//   });

export function createNoAccessPage({
  appName,
  fibreUrl,
  portalUrl,
}: {
  appName: string;
  /** NEXT_PUBLIC_FIBRE_URL — defaults to production. */
  fibreUrl?: string | undefined;
  /** NEXT_PUBLIC_MY_URL — the participant portal. Defaults to production. */
  portalUrl?: string | undefined;
}) {
  const base = fibreUrl ?? 'https://thefibre.app';
  const portal = portalUrl ?? 'https://my.thethread.app';
  return function NoAccess() {
    return (
      <main className="min-h-screen bg-white text-neutral-900">
        <div className="mx-auto max-w-xl px-6 py-20">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            {appName}
          </div>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">
            You don&apos;t have a seat in {appName}
          </h1>
          {/* Most people who land here are MEMBERS, not admins — they joined
              a community or enrolled in a thread, which gives them a Fibre
              account and no seat in any app. The old copy told them to
              "apply for a Fibre account" they already had, and offered no way
              onward. Their home is the portal, so that is the first thing
              offered now (2026-09-24, after a member reached this state
              seconds after paying). */}
          <p className="mt-4 text-neutral-600 leading-relaxed">
            You&apos;re signed in, but this account isn&apos;t set up to use
            {' '}{appName}. If you joined a community or enrolled in
            something, everything you&apos;re part of lives on your own page.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-5">
            <a
              href={portal}
              className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800"
            >
              Go to your page
            </a>
            <a
              href={`${base}/request-access`}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
            >
              Apply for a Fibre account
            </a>
          </div>
          <p className="mt-8 text-sm text-neutral-500 leading-relaxed">
            Run a workspace? Ask an admin to switch {appName} on under{' '}
            <em>Settings → Apps</em>.
          </p>
        </div>
      </main>
    );
  };
}
