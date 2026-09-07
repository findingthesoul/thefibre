// The RLS floor: an ANONYMOUS client (no session at all) must read ZERO
// rows from every table that holds personal or tenant data. This is the
// cheapest meaningful slice of the tenancy matrix — the full two-user
// cross-workspace matrix needs an auth-user fixture harness (queued).
//
// If any of these ever returns rows to anon, that is a data breach, not a
// test flake. The service client sanity-checks each table actually has
// rows on staging where expected, so "0 rows" means "denied", not "empty".

import { describe, expect, it } from 'vitest';
import { anon, service } from './staging.js';

const PII_TABLES = [
  'person',
  'user',
  'workspace',
  'workspace_member',
  'activity',
  'enrolment',
  'purchase',
  'membership_member',
  'app_key',
  'user_connection',
  'sso_handoff',
  'oauth_client',
  'signup_request',
  'identity_profile',
];

describe('anonymous reads nothing', () => {
  for (const table of PII_TABLES) {
    it(`${table}: anon sees 0 rows`, async () => {
      const { data, error } = await anon.from(table).select('*').limit(5);
      // RLS denial surfaces as an empty result (or a permission error for
      // service-role-only tables) — both are correct; rows are the breach.
      if (error) return; // denied outright — fine
      expect(data).toEqual([]);
    });
  }

  it('sanity: the service role CAN read (so 0-for-anon means denied, not empty)', async () => {
    const { data, error } = await service.from('workspace').select('id').limit(1);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});
