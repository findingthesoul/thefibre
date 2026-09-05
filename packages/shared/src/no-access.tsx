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
}: {
  appName: string;
  /** NEXT_PUBLIC_FIBRE_URL — defaults to production. */
  fibreUrl?: string | undefined;
}) {
  const base = fibreUrl ?? 'https://thefibre.app';
  return function NoAccess() {
    return (
      <main className="min-h-screen bg-white text-neutral-900">
        <div className="mx-auto max-w-xl px-6 py-20">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            {appName}
          </div>
          <h1 className="mt-3 text-3xl font-medium tracking-tight">
            Not yet available for this account
          </h1>
          <p className="mt-4 text-neutral-600 leading-relaxed">
            Your account either doesn&apos;t exist on The Fibre yet, or this
            workspace hasn&apos;t turned {appName} on. Apply for a Fibre
            account, or ask your workspace admin to activate {appName} under{' '}
            <em>Settings → Apps</em>.
          </p>
          <div className="mt-10 flex gap-5">
            <a
              href={`${base}/request-access`}
              className="rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800"
            >
              Apply for a Fibre account
            </a>
            <a
              href={base}
              className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
            >
              Open The Fibre →
            </a>
          </div>
        </div>
      </main>
    );
  };
}
