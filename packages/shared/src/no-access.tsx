// The "this account can't use this app HERE" page — one factory instead of
// five byte-alike copies (component-inventory.md Phase 4; the five differed
// only by app name). Shared has no next/node dependency (house rule — see
// createSidebarShell's injection), so the env value is passed in by the
// app's own page file and links are plain <a> (they point at the platform
// origin, where next/link gives no client-nav anyway):
//
//   export default createNoAccessPage({
//     appName: 'Meet',
//     fibreUrl: process.env.NEXT_PUBLIC_FIBRE_URL,
//     context: async () => { ...loadAppShell... },   // optional
//     Switch,                                         // optional, client
//   });
//
// Sjoerd, 2026-09-27, signed in with Doab.ai active and opening Thread:
// *"I am logged in in Doab... yet my profile has more... it should have a
// warning: you're in the workspace Doab.ai, which has no access to this
// app... do you want to continue to a different workspace (if you have it)
// ... or go to the fibre."* The page said "You don't have a seat in Thread",
// which was false — the seat was in another workspace. So the page now
// takes CONTEXT: which workspace is active, and which of the person's other
// workspaces run this app. With context it names the workspace and offers
// the switch; without (no session, or the loader failed) it keeps the old
// member-first copy, because most people who land here are members with no
// seat anywhere and their home is the portal.

import type { ComponentType } from 'react';

export type NoAccessAlternative = { id: string; name: string };

export type NoAccessContext = {
  /** The workspace the session is acting in — the one without this app. */
  workspaceName: string | null;
  /** The person's OTHER workspaces where this app is switched on and they hold a seat. */
  alternatives: NoAccessAlternative[];
};

/** The injected switcher: a client component bound to the app's own switch
 *  action (server → client cannot pass a function, so the binding is a
 *  component, the same way the user menu is bound per app). */
export type NoAccessSwitchProps = { workspaces: NoAccessAlternative[] };

export function createNoAccessPage({
  appName,
  fibreUrl,
  portalUrl,
  context,
  Switch,
}: {
  appName: string;
  /** NEXT_PUBLIC_FIBRE_URL — defaults to production. */
  fibreUrl?: string | undefined;
  /** NEXT_PUBLIC_MY_URL — the participant portal. Defaults to production. */
  portalUrl?: string | undefined;
  /** Where the session stands: active workspace + alternatives. May throw or
   *  return null; the page then falls back to the context-free copy. */
  context?: (() => Promise<NoAccessContext | null>) | undefined;
  Switch?: ComponentType<NoAccessSwitchProps> | undefined;
}) {
  const base = fibreUrl ?? 'https://thefibre.app';
  const portal = portalUrl ?? 'https://my.thethread.app';

  return async function NoAccess() {
    let ctx: NoAccessContext | null = null;
    if (context) {
      try {
        ctx = await context();
      } catch {
        ctx = null;
      }
    }
    const here = ctx?.workspaceName ?? null;
    const alternatives = ctx?.alternatives ?? [];

    return (
      <main className="min-h-screen bg-white text-neutral-900">
        <div className="mx-auto max-w-xl px-6 py-20">
          <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">
            {appName}
          </div>

          {here ? (
            <>
              <h1 className="mt-3 text-3xl font-medium tracking-tight">
                {appName} isn&apos;t switched on in {here}
              </h1>
              <p className="mt-4 text-neutral-600 leading-relaxed">
                You&apos;re signed in and working in <strong className="font-medium text-neutral-900">{here}</strong>,
                and that workspace doesn&apos;t run {appName}.
                {alternatives.length > 0
                  ? ` You do have ${appName} in ${alternatives.length === 1 ? 'another workspace' : 'other workspaces'} — continue there, or go to The Fibre.`
                  : ' If you joined a community or enrolled in something, everything you’re part of lives on your own page.'}
              </p>
              {alternatives.length > 0 && Switch && (
                <div className="mt-8">
                  <Switch workspaces={alternatives} />
                </div>
              )}
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <a
                  href={`${base}/`}
                  className={
                    alternatives.length > 0
                      ? 'text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4'
                      : 'rounded-md bg-neutral-900 text-white px-5 py-2.5 text-sm font-medium hover:bg-neutral-800'
                  }
                >
                  Go to The Fibre
                </a>
                <a
                  href={portal}
                  className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4"
                >
                  Go to your page
                </a>
              </div>
              <p className="mt-8 text-sm text-neutral-500 leading-relaxed">
                Run {here}? Switch {appName} on under <em>Settings → Apps</em> in The Fibre, or ask
                an admin to.
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-3 text-3xl font-medium tracking-tight">
                You don&apos;t have a seat in {appName}
              </h1>
              {/* Most people who land here are MEMBERS, not admins — they joined
                  a community or enrolled in a thread, which gives them a Fibre
                  account and no seat in any app. The old copy told them to
                  "apply for a Fibre account" they already had, and offered no way
                  onward. Their home is the portal, so that is the first thing
                  offered (2026-09-24, after a member reached this state seconds
                  after paying). */}
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
            </>
          )}
        </div>
      </main>
    );
  };
}

/**
 * The context every in-family app passes: built from the same shell loader
 * the (app) layout uses, so the page and the gate that sent someone here
 * cannot disagree about which workspaces count. Kept here so seven page
 * files do not each re-derive "alternatives = has_app and not the one I am
 * in".
 */
export function noAccessContextFromShell(shell: {
  ok: boolean;
  me?: { workspace?: { name?: string | null } | null };
  workspaces?: { id: string; name: string | null; has_app: boolean; is_chosen?: boolean }[];
}): NoAccessContext | null {
  if (!shell.ok) return null;
  return {
    workspaceName: shell.me?.workspace?.name ?? null,
    alternatives: (shell.workspaces ?? [])
      .filter((w) => w.has_app && !w.is_chosen)
      .map((w) => ({ id: w.id, name: w.name ?? 'Untitled workspace' })),
  };
}
