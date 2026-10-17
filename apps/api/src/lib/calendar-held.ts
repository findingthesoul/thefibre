// Who holds which session in their calendar (thread_calendar_held,
// 20261017093521). Its own module because both the rolling window
// (calendar-window.ts) and the organiser's SEND (calendar-invite.ts) write it,
// and the window already imports the SEND's helpers.

import { adminClient } from '../db.js';

/** Record that `email` holds (REQUEST) or no longer holds (CANCEL) a session.
 *  Every send path writes it, so the next plan knows. */
export async function recordHeld(row: {
  workspace_id: string;
  thread_id: string;
  engagement_id: string;
  email: string;
  method: 'REQUEST' | 'CANCEL';
  sequence: number;
  source: 'window' | 'send' | 'thread_end';
}): Promise<void> {
  const { error } = await adminClient
    .from('thread_calendar_held')
    .upsert({ ...row, email: row.email.toLowerCase(), sent_at: new Date().toISOString() }, { onConflict: 'engagement_id,email' });
  if (error) console.error('[calendar-held] not recorded', error.message);
}

