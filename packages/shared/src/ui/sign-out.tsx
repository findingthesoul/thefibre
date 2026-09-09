'use client';

// Sign out, for the MEMBER-facing pages.
//
// The organiser apps already have this inside `ui/user-menu` — the avatar
// menu with theme, sidebar and workspace switching. None of that exists for
// a member: they have no workspace, no sidebar and no preferences. What they
// have is a page that knows their email and, until now, no way to leave it
// (Sjoerd, 2026-09-09: "logout (not possible now)").
//
// The app-bound half is INJECTED, the same rule user-menu follows: each app
// has its own Supabase browser client and its own idea of where to land
// afterwards, and this package carries neither.

import { useState } from 'react';

export function SignOut({
  onSignOut,
  label = 'Sign out',
  busyLabel,
  className = '',
}: {
  /** supabase.auth.signOut() plus wherever the app sends people afterwards. */
  onSignOut: () => Promise<void>;
  label?: string;
  busyLabel?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onSignOut().finally(() => setBusy(false));
      }}
      className={`min-h-11 text-sm text-ink-subtle underline underline-offset-4 hover:text-ink disabled:opacity-50 ${className}`}
    >
      {busy ? (busyLabel ?? label) : label}
    </button>
  );
}
