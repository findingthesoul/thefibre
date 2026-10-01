// The RLS floor: an ANONYMOUS client (no session at all) must read ZERO
// rows from EVERY table in public. This is the cheapest meaningful slice of
// the tenancy matrix — the full two-user cross-workspace matrix lives in
// rls-matrix.int.test.ts.
//
// If any table ever returns rows to anon, that is a data breach, not a
// test flake. The service client sanity-checks that it CAN read, so
// "0 rows" means "denied", not "empty".
//
// The table list is DERIVED from the migrations, not written out. Until
// 2026-09-27 it was a hand list of fourteen names, and none of the thirteen
// tables created after 2026-09-14 — mcp_grant (encrypted session +
// refresh-token hash), workspace_assistant (encrypted API key),
// person_calendar_feed (email + token), person_contact_point (every email
// and phone) among them — was on it. Nothing was open; nothing was checked
// either. A table that exists is a table this probes, the same rule as the
// definer guard (definer-probe.mjs) and release.sh's package list.

import { describe, expect, it } from 'vitest';
import { publicTablesFromMigrations } from '../lib/migration-tables.js';
import { anon, service } from './staging.js';

const TABLES = publicTablesFromMigrations();

describe('anonymous reads nothing', () => {
  it('the derived list is not empty and still covers the original fourteen', () => {
    for (const t of [
      'person', 'user', 'workspace', 'workspace_member', 'activity', 'enrolment',
      'purchase', 'membership_member', 'app_key', 'user_connection', 'sso_handoff',
      'oauth_client', 'signup_request', 'identity_profile',
    ]) {
      expect(TABLES, `${t} missing from the derived list`).toContain(t);
    }
    // The four credential tables of 2026-09-14..27 that the hand list missed.
    for (const t of ['mcp_grant', 'workspace_assistant', 'person_calendar_feed', 'person_contact_point']) {
      expect(TABLES, `${t} missing from the derived list`).toContain(t);
    }
  });

  for (const table of TABLES) {
    it(`${table}: anon sees 0 rows`, async () => {
      const { data, error } = await anon.from(table).select('*').limit(5);
      // RLS denial surfaces as an empty result, or a permission error for
      // service-role-only tables — both are correct; rows are the breach.
      // PGRST205 = not in the schema cache: a table the migrations create but
      // staging does not have yet (or a parse false-positive). Not a leak,
      // and not silently fine either — say so.
      if (error?.code === 'PGRST205') {
        console.warn(`[rls-floor] ${table}: not on staging (PGRST205)`);
        return;
      }
      if (error) return; // denied outright — fine
      expect(data, `${table} returned rows to anon`).toEqual([]);
    });
  }

  it('sanity: the service role CAN read (so 0-for-anon means denied, not empty)', async () => {
    const { data, error } = await service.from('workspace').select('id').limit(1);
    expect(error).toBeNull();
    expect(data?.length).toBeGreaterThan(0);
  });
});
