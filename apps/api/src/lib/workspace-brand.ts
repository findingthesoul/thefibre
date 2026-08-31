// Whose email this is — the single place that answers it.
//
// Every outgoing email used one shell (The Fibre's wordmark, The Fibre's
// footer) and one sender, because there was only ever one workspace that
// mattered. With Festival of Trust running its own enrolments, an email that
// says The Fibre is an email from the wrong organisation.
//
// SPoT, on purpose, in the shape of lib/payment-accounts.ts: readers ask here,
// never the workspace row directly, so when branding grows a second source
// (an organisation's logo, a team's) exactly one function changes.
//
// The note is the organiser's own words inside the platform's emails. Two
// levels: the workspace sets a default, a thread may override it. Null at the
// thread means inherit; empty string means this thread deliberately has none —
// a distinction that matters, or clearing a note would silently restore the
// default.

import { adminClient } from '../db.js';

export type WorkspaceBrand = {
  /** Replaces the platform wordmark at the top of the email. */
  logoUrl: string | null;
  /** Display name in the inbox. Needs no DNS. */
  fromName: string | null;
  /** Sender address. Only sends if its domain is verified; see client.ts. */
  fromAddress: string | null;
  replyTo: string | null;
  /** The workspace-wide default note. */
  note: string | null;
};

const EMPTY: WorkspaceBrand = {
  logoUrl: null,
  fromName: null,
  fromAddress: null,
  replyTo: null,
  note: null,
};

export async function getWorkspaceBrand(workspaceId: string): Promise<WorkspaceBrand> {
  if (!workspaceId) return EMPTY;

  // thread_settings.{email_from_name, email_footer_note} are READ FALLBACKS,
  // the same arrangement payments got in v0.13.95 (lib/payment-accounts.ts).
  //
  // They are not legacy in the usual sense: Settings → Emails & defaults has
  // been writing them since v0.13.x and NOTHING has ever read them at send
  // time. Someone set a sender name, saved it, and every email since went out
  // saying The Fibre. Reading them here is what makes those saves mean
  // something — as of now the platform value wins, and this fills in behind.
  // Never write them again.
  const [{ data, error }, { data: legacy }] = await Promise.all([
    adminClient
      .from('workspace')
      .select('brand_logo_url, email_from_name, email_from_address, email_reply_to, enrolment_note')
      .eq('id', workspaceId)
      .maybeSingle(),
    adminClient
      .from('thread_settings')
      .select('email_from_name, email_footer_note')
      .eq('workspace_id', workspaceId)
      .maybeSingle(),
  ]);
  if (error || !data) {
    // Branding is decoration; an email that cannot look right must still go
    // out looking like the platform's.
    if (error) console.warn('[workspace-brand] read failed', error.message);
    return EMPTY;
  }
  return {
    logoUrl: data.brand_logo_url ?? null,
    fromName: data.email_from_name ?? legacy?.email_from_name ?? null,
    fromAddress: data.email_from_address ?? null,
    replyTo: data.email_reply_to ?? null,
    note: data.enrolment_note ?? legacy?.email_footer_note ?? null,
  };
}

/**
 * The note this thread sends. Null at the thread inherits the workspace's;
 * an empty string is a decision and stays empty.
 */
export function noteFor(
  threadNote: string | null | undefined,
  brand: WorkspaceBrand,
): string | null {
  if (threadNote === null || threadNote === undefined) return brand.note?.trim() || null;
  return threadNote.trim() || null;
}
