// Public-ish accept page. Anyone with the token URL can preview the invite.
// Accepting requires the signed-in user's email to match the invitee email.

import Link from 'next/link';
import { APPS, legalFooterLine } from '@thefibre/shared';
import { publicFetch, PublicApiError } from '@/lib/public-api';
import { apiFetch, ApiError } from '@/lib/api';
import { serverSupabase } from '@/lib/supabase/server';
import { AcceptForm, InviteSignInButton } from './form';

type InvitePeek = {
  team: { id: string; name: string; slug: string } | null;
  invitee: { id: string; email: string; full_name: string | null } | null;
  role: 'lead' | 'member';
  inviter: { full_name: string | null; email: string | null } | null;
};

type Me = {
  user: { id: string; email: string; full_name: string | null };
};

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // 1) Peek (no auth) so we can render even before sign-in.
  let invite: InvitePeek | null = null;
  let peekError: string | null = null;
  try {
    invite = await publicFetch<InvitePeek>(
      `/api/v1/meet/public/invite/${encodeURIComponent(token)}`,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 410) {
      peekError = 'already-used';
    } else if (e instanceof PublicApiError && e.status === 404) {
      peekError = 'not-found';
    } else {
      peekError = 'unknown';
    }
  }

  // 2) Check whether we're signed in (so we can decide which CTA to show).
  const supabase = await serverSupabase();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  let signedInEmail: string | null = null;
  if (authUser) {
    try {
      const me = await apiFetch<Me>('/api/v1/auth/me');
      signedInEmail = me.user.email ?? null;
    } catch (e) {
      // Surface as not-signed-in for the purpose of this page.
      if (!(e instanceof ApiError)) throw e;
    }
  }

  if (peekError === 'already-used') {
    return (
      <Shell title="Invite already used">
        <p className="mt-3 text-sm text-neutral-600">
          This invite link has already been accepted (or was revoked). If you
          think that&apos;s wrong, ask whoever invited you to send a new one.
        </p>
        <Link
          href="https://meet.thefibre.app"
          className="mt-6 inline-block text-sm text-neutral-700 underline"
        >
          Go to {APPS['fibre-meet'].name} →
        </Link>
      </Shell>
    );
  }
  if (peekError === 'not-found' || !invite || !invite.team || !invite.invitee) {
    return (
      <Shell title="Invite not found">
        <p className="mt-3 text-sm text-neutral-600">
          We couldn&apos;t find this invite. The link may be incorrect, expired
          or revoked.
        </p>
      </Shell>
    );
  }

  const inviteeEmail = invite.invitee.email;
  const emailMatches =
    signedInEmail &&
    inviteeEmail &&
    signedInEmail.toLowerCase() === inviteeEmail.toLowerCase();

  // Auto-redirect to sign-in if not signed in yet.
  if (!signedInEmail) {
    // We use a marker in the URL so the user can finish the flow after auth.
    // /auth/callback redirects to /dashboard by default; the user can paste
    // the invite link again or click Back. For now we show a Sign in button.
    return (
      <Shell
        title={`Join ${invite.team.name}`}
        inviter={invite.inviter?.full_name ?? invite.inviter?.email ?? null}
      >
        <Details
          inviteeEmail={inviteeEmail}
          role={invite.role}
          inviter={invite.inviter?.full_name ?? invite.inviter?.email ?? null}
        />
        <p className="mt-6 text-sm text-neutral-700">
          Sign in with Google as <strong>{inviteeEmail}</strong> to accept.
        </p>
        <div className="mt-4">
          <InviteSignInButton token={token} />
        </div>
      </Shell>
    );
  }

  if (!emailMatches) {
    return (
      <Shell
        title={`Join ${invite.team.name}`}
        inviter={invite.inviter?.full_name ?? invite.inviter?.email ?? null}
      >
        <Details
          inviteeEmail={inviteeEmail}
          role={invite.role}
          inviter={invite.inviter?.full_name ?? invite.inviter?.email ?? null}
        />
        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You&apos;re signed in as <strong>{signedInEmail}</strong> but this
          invite is for <strong>{inviteeEmail}</strong>. Sign out, then sign
          back in with the right account.
        </div>
        <form action="/auth/sign-out" method="post" className="mt-4">
          <button
            type="submit"
            className="text-sm text-neutral-600 underline underline-offset-2"
          >
            Sign out
          </button>
        </form>
      </Shell>
    );
  }

  return (
    <Shell
      title={`Join ${invite.team.name}`}
      inviter={invite.inviter?.full_name ?? invite.inviter?.email ?? null}
    >
      <Details
        inviteeEmail={inviteeEmail}
        role={invite.role}
        inviter={invite.inviter?.full_name ?? invite.inviter?.email ?? null}
      />
      <div className="mt-8">
        <AcceptForm token={token} teamSlug={invite.team.slug} />
      </div>
    </Shell>
  );
}

function Shell({
  title,
  inviter,
  children,
}: {
  title: string;
  inviter?: string | null;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto max-w-lg px-6 py-20">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-8">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
            You&apos;ve been invited
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight">
            {title}
          </h1>
          {inviter && (
            <div className="mt-1 text-sm text-neutral-500">by {inviter}</div>
          )}
          {children}
        </div>
        <div className="mt-6 text-center text-xs text-neutral-400">
          {legalFooterLine()}
        </div>
      </div>
    </main>
  );
}

function Details({
  inviteeEmail,
  role,
  inviter,
}: {
  inviteeEmail: string;
  role: string;
  inviter: string | null;
}) {
  return (
    <dl className="mt-8 space-y-4 text-sm">
      <Row label="For" value={inviteeEmail} />
      <Row label="Role" value={role === 'lead' ? 'Lead' : 'Member'} />
      {inviter && <Row label="Inviter" value={inviter} />}
    </dl>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr] gap-3">
      <dt className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
        {label}
      </dt>
      <dd className="text-neutral-900">{value}</dd>
    </div>
  );
}
