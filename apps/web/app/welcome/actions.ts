'use server';

import { redirect } from 'next/navigation';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_WELCOME } from '@/lib/prefs-shared';

// Finishing OR skipping the welcome sequence sets the one stored bit; the
// steps themselves left their marks in the data (identity_profile, the
// locale cookie) — nothing else to record.
export async function finishWelcome(): Promise<never> {
  await savePref(COOKIE_WELCOME, 'done');
  redirect('/dashboard');
}
