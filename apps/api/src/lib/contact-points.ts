// A person's labelled addresses (20260915090000,
// docs/people-in-two-capacities-proposal.md §A).
//
// The normaliser here mirrors public.contact_point_normalise() in SQL — the
// API normalises before it writes so a value compares equal to what the sync
// trigger stores. Keep the two in step; contact-points.test.ts pins the cases.

import { z } from 'zod';

export const CONTACT_LABELS = ['work', 'private', 'other'] as const;
export type ContactLabel = (typeof CONTACT_LABELS)[number];
export type ContactKind = 'email' | 'phone';

export type ContactPoint = {
  kind: ContactKind;
  value: string;
  label: ContactLabel | null;
  org_id: string | null;
  is_primary: boolean;
};

export function normaliseContactValue(kind: ContactKind, raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v) return null;
  if (kind === 'email') return v.toLowerCase();
  const digits = v.replace(/[^0-9+]/g, '').replace(/^00/, '+');
  return digits || null;
}

const EMAIL = z.string().email();

export const ContactPointInput = z.object({
  kind: z.enum(['email', 'phone']),
  value: z.string().min(1).max(254),
  label: z.enum(CONTACT_LABELS).nullable().optional(),
  org_id: z.string().uuid().nullable().optional(),
  is_primary: z.boolean().optional(),
});

export type ContactPointsResult =
  | { ok: true; points: ContactPoint[]; primaryEmail: string | null; primaryPhone: string | null }
  | { ok: false; error: string };

/**
 * Clean a submitted list: normalise, drop exact repeats (first wins), check
 * emails, and settle exactly one primary per kind that has any rows — the
 * flagged one, else the first. An email is required: every person is
 * reachable by one (PersonCreate has always said so).
 */
export function cleanContactPoints(
  input: z.infer<typeof ContactPointInput>[],
): ContactPointsResult {
  const seen = new Set<string>();
  const points: ContactPoint[] = [];
  for (const row of input) {
    const value = normaliseContactValue(row.kind, row.value);
    if (!value) continue;
    if (row.kind === 'email' && !EMAIL.safeParse(value).success) {
      return { ok: false, error: `Not an email address: ${row.value}` };
    }
    if (row.kind === 'phone' && value.replace(/\D/g, '').length < 6) {
      return { ok: false, error: `Not a phone number: ${row.value}` };
    }
    const key = `${row.kind}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({
      kind: row.kind,
      value,
      label: row.label ?? null,
      // Only a work address says which organisation it is for.
      org_id: row.label === 'work' ? (row.org_id ?? null) : null,
      is_primary: !!row.is_primary,
    });
  }

  const primaryOf = (kind: ContactKind): string | null => {
    const ofKind = points.filter((p) => p.kind === kind);
    if (!ofKind.length) return null;
    const chosen = ofKind.find((p) => p.is_primary) ?? ofKind[0]!;
    for (const p of ofKind) p.is_primary = p === chosen;
    return chosen.value;
  };
  const primaryEmail = primaryOf('email');
  const primaryPhone = primaryOf('phone');
  if (!primaryEmail) return { ok: false, error: 'A person needs at least one email address.' };
  return { ok: true, points, primaryEmail, primaryPhone };
}

/** Canonical order of a duplicate pair — the order the SQL candidates use. */
export function pairOrder(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}
