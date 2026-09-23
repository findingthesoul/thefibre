// The workspace behind a public Meet page — its own module, not an export of
// the page beside it: Next generates a type for every page file that forbids
// any export other than the ones it knows (`satisfies {[x:string]: never}`),
// so a component exported from page.tsx fails the build by construction.
// Caught 2026-09-23 by the Connections session, whose release the error
// blocked; the page's own stale .next artifact had hidden it here.
// Two routes render it, which is reason enough for a module of its own.

/** The workspace behind a public page: who is hosting, in the organisational
 *  sense (Sjoerd, 2026-09-23, on his own booking page: "No workspace link?").
 *  `url` is the workspace's own public address — the /{owner} page The Thread
 *  serves — or null when it holds none. */
export type PublicWorkspace = {
  name: string | null;
  logo_url: string | null;
  url: string | null;
};

/** A quiet line above the page's own title: logo, name, and a link out when
 *  the workspace has a public page. Never the loudest thing on a booking
 *  page — the person and the meeting stay that. */
export function WorkspaceLine({
  workspace,
  className = '',
}: {
  workspace: PublicWorkspace | null | undefined;
  className?: string;
}) {
  if (!workspace?.name && !workspace?.logo_url) return null;
  const inner = (
    <>
      {workspace.logo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={workspace.logo_url}
          alt={workspace.name ?? ''}
          className="h-6 w-auto max-w-[120px] object-contain"
        />
      ) : null}
      {workspace.name && <span className="truncate">{workspace.name}</span>}
    </>
  );
  const shape = `inline-flex items-center gap-2 text-sm text-neutral-500 ${className}`;
  return workspace.url ? (
    <a
      href={workspace.url}
      className={`${shape} hover:text-neutral-900 transition-colors`}
    >
      {inner}
    </a>
  ) : (
    <div className={shape}>{inner}</div>
  );
}
