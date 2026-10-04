// Who the browser pack signs in as, held by the release gate.
//
// e2e/identities.ts gives the pack two identities: the FIXTURE account, which
// is nobody and is the default, and the OWNER of the `default` workspace, a
// real person, for three read-only specs that need that workspace's data.
// The rule that keeps a real person's account from being written to by a
// test is not something a reviewer will keep noticing, so it is checked:
//
//   1. only the files on the allow-list below may sign in as the owner;
//   2. a file that signs in as the owner clicks nothing that saves;
//   3. the DEFAULT sign-in goes through the fixture resolver and nothing
//      else, and that resolver refuses any account that is not the fixture.
//
// These read the spec files as text: the pack itself needs staging and a
// browser and is not part of `pnpm verify`; this is.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { assertStagingProject, PRODUCTION_REF, STAGING_REF } from '../e2e/staging-guard.ts';

const E2E = join(dirname(fileURLToPath(import.meta.url)), '..', 'e2e');
const read = (f) => readFileSync(join(E2E, f), 'utf8');
const specs = readdirSync(E2E).filter((f) => f.endsWith('.spec.ts'));

/** The ONLY specs that may sign in as a real person, and why each needs to. */
const OWNER_SPECS = {
  'contact-invoices.spec.ts': 'reads purchase rows of real staging contacts',
  'org-names.spec.ts': 'searches for the EBBF organisation in the default workspace',
  'organiser-screens.spec.ts': 'opens the year-agenda thread the owner organises',
};
const OWNER_CALL = /\b(ownerLandUrl|landSignedInAsOwner|resolveOwnerIdentity)\b/;

/** Controls that commit something. Opening a dialog or typing into a search
 *  box is not a write; pressing one of these is. */
const SAVES = [
  /getByRole\('button',\s*\{\s*name:\s*\/[^/]*\b(save|opslaan|delete|verwijder|remove|confirm|bevestig|submit|send|verstuur)/i,
  /button\[type="submit"\]/,
  /\.press\('Enter'\)/,
];

describe('the browser pack and a real person’s account', () => {
  it('finds the specs (a guard on the reader)', () => {
    expect(specs.length).toBeGreaterThanOrEqual(9);
    for (const f of Object.keys(OWNER_SPECS)) expect(specs, f).toContain(f);
  });

  it('only the allow-listed specs sign in as the owner', () => {
    const offenders = specs.filter((f) => OWNER_CALL.test(read(f)) && !(f in OWNER_SPECS));
    expect(offenders, 'these specs sign in as a real person and are not on the allow-list').toEqual([]);
  });

  it('every allow-listed spec still uses the owner (or comes off the list)', () => {
    for (const f of Object.keys(OWNER_SPECS)) expect(OWNER_CALL.test(read(f)), f).toBe(true);
  });

  for (const f of Object.keys(OWNER_SPECS)) {
    it(`${f} presses nothing that saves`, () => {
      const source = read(f);
      for (const pattern of SAVES) {
        expect(pattern.test(source), `${f} matches ${pattern}: an owner spec must only look`).toBe(false);
      }
    });
  }

  it('no spec resolves an account by position in a list', () => {
    for (const f of [...specs, 'helpers.ts', 'identities.ts']) {
      const source = read(f);
      // "the oldest user" was the old resolver; it is how the pack came to act
      // as a real person, and once as a random test member.
      expect(/order\('created_at'[^)]*\)\s*\.limit\(1\)/.test(source.replace(/\s+/g, ' ')) && /from\('user'\)/.test(source), f).toBe(false);
    }
  });
});

describe('the default identity is the fixture', () => {
  const helpers = read('helpers.ts');
  const identities = read('identities.ts');

  it('signedInLandUrl goes through the fixture resolver, and only that', () => {
    const body = helpers.slice(helpers.indexOf('export async function signedInLandUrl('), helpers.indexOf('export async function ownerLandUrl('));
    expect(body).toContain('ensureFixtureIdentity(stagingService(), stagingUrl)');
    expect(body).not.toMatch(/resolveOwnerIdentity|from\('user'\)/);
  });

  it('the fixture resolver refuses any other account, by address', () => {
    expect(identities).toMatch(/email: 'e2e-fixture@example\.com'/);
    const build = identities.slice(identities.indexOf('async function build('), identities.indexOf('export function assertFixture('));
    expect(build, 'what build() returns passes through assertFixture').toMatch(/return assertFixture\(/);
    const guard = identities.slice(identities.indexOf('export function assertFixture('));
    expect(guard).toMatch(/identity\.email\.toLowerCase\(\) !== E2E_FIXTURE\.email/);
    expect(guard).toMatch(/throw new Error/);
  });

  it('the owner resolver never falls back, and is never the fixture', () => {
    const owner = identities.slice(identities.indexOf('export async function resolveOwnerIdentity('));
    expect(owner).toMatch(/live\.length !== 1/);
    expect(owner).toMatch(/the owner resolved to the fixture/);
    expect(owner).not.toMatch(/order\(|limit\(1\)/);
  });

  it('no personal address is written into the identity files', () => {
    for (const source of [helpers, identities]) {
      const addresses = source.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) ?? [];
      expect(addresses.filter((a) => !a.endsWith('@example.com'))).toEqual([]);
    }
  });
});

describe('the fixture is a super admin on STAGING ONLY', () => {
  const identities = read('identities.ts');

  it('the guard lets the staging project through', () => {
    expect(() => assertStagingProject(`https://${STAGING_REF}.supabase.co`, 'x')).not.toThrow();
  });

  it('the guard refuses the PRODUCTION project, by name', () => {
    expect(() => assertStagingProject(`https://${PRODUCTION_REF}.supabase.co`, 'the fixture super-admin grant')).toThrow(
      /REFUSED: the fixture super-admin grant is for the staging project .* points at PRODUCTION/,
    );
  });

  it('the guard refuses anything that is merely "not production"', () => {
    for (const url of ['https://someotherproject.supabase.co', '', undefined, null, 'not a url', `https://${STAGING_REF}.supabase.co.evil.example`, `https://evil.example/${STAGING_REF}.supabase.co`]) {
      expect(() => assertStagingProject(url, 'x'), String(url)).toThrow(/REFUSED/);
    }
  });

  it('nothing is written before the guard, and the grant sits directly behind its own', () => {
    const build = identities.slice(identities.indexOf('async function build('), identities.indexOf('export function assertFixture('));
    const firstGuard = build.indexOf('assertStagingProject(projectUrl');
    const firstWrite = build.search(/\.(insert|update|upsert|createUser)\(/);
    expect(firstGuard).toBeGreaterThan(-1);
    expect(firstGuard, 'the guard comes before any write').toBeLessThan(firstWrite);
    // The grant itself: the guard is the statement immediately before it.
    const grant = build.indexOf('is_super_admin: true');
    expect(grant).toBeGreaterThan(-1);
    const before = build.slice(0, grant);
    const lastGuard = before.lastIndexOf('assertStagingProject(projectUrl');
    expect(before.slice(lastGuard).match(/\.(insert|update|upsert)\(/g)?.length, 'only the grant follows its guard').toBe(1);
    // And is_super_admin is set nowhere else in the pack.
    for (const f of [...specs, 'helpers.ts']) expect(read(f), f).not.toContain('is_super_admin');
  });

  it('the seeded purchases are on fixed refs and @example.com payers', () => {
    expect(identities).toContain("item_ref: 'e2e-fixture-platform-paid'");
    expect(identities).toContain("item_ref: 'e2e-fixture-invoice-pending'");
    const payers = identities.match(/payer_email: '([^']+)'/g) ?? [];
    expect(payers.length).toBe(2);
    for (const p of payers) expect(p).toMatch(/@example\.com'/);
  });
});
