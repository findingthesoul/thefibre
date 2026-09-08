// Who is asking, when the asker is a participant rather than an organiser.
//
// Two different people reach this API. An ORGANISER arrives with a workspace
// session: `ctx` carries workspace + role, and RLS does the scoping. A
// PARTICIPANT — someone who bought a ticket, booked a call, or joined a
// community — has no workspace membership at all. Their token proves exactly
// one thing: an email address they can receive mail at (Google, or the
// platform's 8-digit code).
//
// So the participant surfaces verify the Supabase session against JWKS here,
// take the email, and nothing else. There are no workspace claims to trust
// and none are read.
//
// This started as two copies — one in routes/thread.ts, one in
// routes/membership-portal.ts — with a comment saying the duplication was
// deliberate so the two participant surfaces could evolve independently.
// That held while each portal answered for its own app. routes/portal.ts
// answers for the platform across all of them, at which point three copies
// of the same JWT verification is just three places to get it wrong.

import { createRemoteJWKSet, jwtVerify } from 'jose';

const jwks = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? createRemoteJWKSet(
      new URL(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
    )
  : null;

/**
 * The verified email behind a participant's bearer token, or null.
 *
 * Null means "not signed in" — never "signed in as nobody". Callers MUST
 * refuse the request on null; there is no anonymous fallback, because the
 * email is the only thing scoping the query that follows.
 */
export async function participantEmailFromAuth(c: {
  req: { header: (n: string) => string | undefined };
}): Promise<string | null> {
  const auth = c.req.header('authorization');
  if (!auth?.startsWith('Bearer ') || !jwks) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), jwks, {
      audience: process.env.API_JWT_AUDIENCE ?? 'authenticated',
    });
    const email = (payload.email as string | undefined) ?? null;
    return email ? email.toLowerCase() : null;
  } catch {
    return null;
  }
}
