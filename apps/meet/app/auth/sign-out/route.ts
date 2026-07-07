import { NextResponse } from 'next/server';
import { serverSupabase } from '@/lib/supabase/server';

// The invite page's wrong-account state posts a plain <form> here — this
// route didn't exist (cleanup sweep 2026-07-07), so that Sign out button
// 404'd. Everywhere else sign-out happens client-side via the user menu.
export async function POST(request: Request) {
  const supabase = await serverSupabase();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL('/', request.url), 303);
}
