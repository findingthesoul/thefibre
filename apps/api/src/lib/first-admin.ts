// The first human in a workspace.
//
// Sjoerd, 2026-09-26, on a workspace he had just made from /admin/workspaces:
// *"Why is - when making a new workspace - not enforced to have one user? -
// and why can't I as super user go there and add a new user or myself?"*
//
// Both halves had the same cause. `POST /workspaces` created the workspace
// row and its subscription and stopped, and "being in a workspace" is not a
// permission but a ROW: the JWT's workspace_id comes from public."user", and
// every members screen acts on that claim. Super-admin lets you see admin
// pages; it does not put a user row anywhere. And the only endpoint that adds
// a member works on the workspace the caller is already in — there is none
// that takes a workspace id.
//
// So an admin-made workspace was a sealed room: nobody inside, and no way in.
// It looked fine from the list, which is the worst part — you found out by
// going to look for Settings → Members and finding nothing there.
//
// The approval flow never had this problem because it ties the workspace to
// the applicant's email, and their user row appears at first sign-in. This
// gives the admin door the same tie, at the moment of creation, which is the
// only moment where refusing costs nothing.

import { adminClient } from '../db.js';
import { resolvePersonId } from './resolve-person.js';
import { sendEmail } from './email/client.js';
import { shell, escapeHtml } from './email/templates.js';
import { emailSignoff, appUrl } from '@thefibre/shared';

export type FirstAdmin = { userId: string; personId: string | null };

/**
 * Put one person into a brand-new workspace as its first admin.
 *
 * Deliberately NOT the invite endpoint's logic. That one carries seat
 * gating, paid-seat consent, and resurrection of a removed colleague — all of
 * which are about a workspace that already has people in it. The first seat
 * is always inside every plan's allowance, there is nobody to resurrect, and
 * there is no admin present to consent to anything.
 *
 * Throws rather than returning an error union: the caller deletes the
 * workspace when this fails, and a half-made workspace is the exact thing
 * this function exists to prevent.
 */
export async function seedFirstAdmin(args: {
  workspaceId: string;
  email: string;
  name?: string | null;
  /** Skip the email in tests and when a human is being moved, not invited. */
  sendInvite?: boolean;
}): Promise<FirstAdmin> {
  const email = args.email.trim().toLowerCase();
  const name = args.name?.trim() || null;

  // Identity invariant: every user has a paired person.
  const personId = await resolvePersonId({
    workspaceId: args.workspaceId,
    email,
    name: name ?? undefined,
    // The existing vocabulary already covers this: they were invited into
    // the workspace. A new PersonSource value would mean widening the type,
    // the SOURCES list and the column's check constraint to say something
    // the reader already understands.
    source: 'member_invite',
    create: true,
  });

  const { data: user, error: uErr } = await adminClient
    .from('user')
    .insert({
      workspace_id: args.workspaceId,
      person_id: personId,
      email,
      full_name: name,
      primary_auth_method: 'google',
      email_verified: false,
    })
    .select('id')
    .single();
  if (uErr || !user) throw new Error(`first admin: user create failed — ${uErr?.message ?? 'no row'}`);

  if (personId) {
    await adminClient.from('person').update({ user_id: user.id }).eq('id', personId);
  }

  // super_admin, not admin: they are the only person here, so they have to be
  // able to do everything an owner does — including making the next admin.
  const { error: mErr } = await adminClient.from('workspace_member').upsert(
    {
      user_id: user.id,
      workspace_id: args.workspaceId,
      workspace_role: 'super_admin',
      relationship_type: 'internal',
    },
    { onConflict: 'user_id,workspace_id' },
  );
  if (mErr) throw new Error(`first admin: membership failed — ${mErr.message}`);

  // fibre-platform admin, explicitly.
  //
  // `resolve_sso_identity` grants this to the first user of a workspace at
  // sign-in, and `grantableSlugs()` excludes fibre-platform from every
  // ordinary invite, so nothing else here would do it. Without it,
  // Settings → Members redirects this person away from the one page they
  // need — the page checks for a fibre-platform membership with role admin.
  const { data: platform } = await adminClient
    .from('app')
    .select('id')
    .eq('slug', 'fibre-platform')
    .maybeSingle();
  if (platform) {
    const { error: aErr } = await adminClient
      .from('app_membership')
      .upsert(
        { user_id: user.id, app_id: platform.id, role: 'admin', is_direct: true },
        { onConflict: 'user_id,app_id' },
      );
    if (aErr) throw new Error(`first admin: platform grant failed — ${aErr.message}`);
  }

  if (args.sendInvite !== false) {
    const fibreUrl = appUrl('fibre-platform', process.env as Record<string, string>);
    const first = (name ?? '').split(/\s+/)[0] || '';
    const text = `Hi ${first},

A workspace has been set up for you on The Fibre. Sign in with this email address to open it:

${fibreUrl}/sign-in

${emailSignoff()}`;
    const html = shell(
      'Your workspace is ready',
      `
        <p style="margin:0 0 16px;font-size:15px;">Hi ${escapeHtml(first)},</p>
        <p style="margin:0 0 16px;font-size:15px;">A workspace has been set up for you on The Fibre. Sign in with this email address to open it.</p>
        <p style="margin:24px 0;">
          <a href="${fibreUrl}/sign-in" style="display:inline-block;background:#171717;color:#ffffff;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none;">Sign in</a>
        </p>
        <p style="margin:24px 0 0;font-size:14px;color:#525252;">${escapeHtml(emailSignoff())}</p>
      `,
    );
    // A failed email does not undo a correct workspace — they can still sign
    // in, and the address is on screen in the members list.
    try {
      await sendEmail({ to: email, subject: 'Your workspace on The Fibre is ready', text, html });
    } catch (e) {
      console.warn('[first-admin] invite email failed', e);
    }
  }

  return { userId: user.id, personId: personId ?? null };
}
