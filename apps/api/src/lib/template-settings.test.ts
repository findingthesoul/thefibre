import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TEMPLATE_THREAD, TEMPLATE_TICKET } from './thread-template-spec.js';

// Sjoerd, 2026-09-25: "Template for threads: settings also need to be in it
// (pricing, image, etc.)"
//
// The image was already there. Pricing was there only in its legacy form:
// `price_cents`, the single price a thread had before tickets existed. When a
// thread HAS tickets they are the pricing — effectivePrice takes the lowest
// active one — so a template of a properly priced thread produced a thread
// reading "Free". The settings he could see were carried; the one that
// decides what people pay was not.
//
// Two shapes of fault, and the second is the nastier:
//
//   MISSING   tickets and categories were never captured.
//   DROPPED   facilitation_language and public_scope WERE captured and then
//             ignored when the template was applied. Worse than missing,
//             because the stored template looked complete and public_scope
//             decides the thread's public address — losing it silently
//             republished a workspace thread under the organiser.
//
// These read the source. Capture and apply WERE two lists in two functions
// that had to agree, and nothing in the type system said so: every field is
// `unknown` on its way through jsonb. That is exactly how they drifted.
//
// Since 2026-10-15 both directions use ONE list (lib/thread-template-spec.ts),
// so "captured AND applied" is now mechanical: a field in TEMPLATE_THREAD.carry
// is written by `carriedOut` and read back by `carriedIn`. These tests check
// the route still goes through the spec both ways; thread-template.int.test.ts
// checks every real column against it.
//
// Asserting the RULE, not the line that implements it. A previous test in
// this codebase matched the implementation it found and so pinned a bug as
// though it were the intent (the "Sends the ticket" badge, 2026-09-25) — it
// could never have failed, and it failed the fix instead.

const src = readFileSync(fileURLToPath(new URL('../routes/thread.ts', import.meta.url)), 'utf8');

/** The object a template stores. */
const structure = (() => {
  const at = src.indexOf('const structure = {');
  expect(at, 'the template structure is still built here').toBeGreaterThan(-1);
  return src.slice(at, src.indexOf('\n  };', at));
})();

/** The thread row built when a template is applied. */
const applied = (() => {
  const at = src.indexOf('...carriedIn(TEMPLATE_THREAD, st)');
  expect(at, 'the create-from-template insert reads the spec').toBeGreaterThan(-1);
  return src.slice(at, src.indexOf('.select(', at));
})();

/** Carried on the way out AND read back on the way in — both through the spec. */
const carried = (field: string) =>
  TEMPLATE_THREAD.carry.includes(field) && structure.includes('carriedOut(TEMPLATE_THREAD') && applied.includes('carriedIn(TEMPLATE_THREAD');

describe('a template carries what a thread charges', () => {
  it('captures tickets, which ARE the price when a thread has them', () => {
    expect(structure).toMatch(/tickets:/);
    expect(structure).toMatch(/carriedOut\(TEMPLATE_TICKET/);
    expect(TEMPLATE_TICKET.carry).toContain('price_cents');
  });

  it('does not carry a ticket sales deadline', () => {
    // An absolute date belonging to one run. A template applied three months
    // later would arrive with a deadline already past and a ticket nobody can
    // buy — the failure would look like "the template is broken".
    expect(structure).not.toMatch(/available_until:/);
    expect(TEMPLATE_TICKET.carry).not.toContain('available_until');
    expect(Object.keys(TEMPLATE_TICKET.skip)).toContain('available_until');
  });

  it('restores them when the template is applied', () => {
    expect(src).toMatch(/from\('thread_ticket'\)\.insert\(\{[\s\S]{0,200}thread_id: thread\.id/);
  });
});

describe('a template carries where a thread belongs', () => {
  it('captures categories as slugs, never ids', () => {
    // thread_category is workspace-scoped and unique on (workspace_id, slug).
    // A template shared into another workspace carrying an id either breaks a
    // foreign key or names somebody else's category.
    expect(structure).toMatch(/category_slugs:/);
    expect(structure).not.toMatch(/category_ids:/);
  });

  it('resolves those slugs in the applying workspace', () => {
    // Bounded forward from the apply block, not back to
    // `seedTemplateEngagements` — that name matches its own DEFINITION
    // earlier in the file, so the slice came out empty and the test failed
    // for a reason that had nothing to do with the code.
    const from = src.indexOf('const tplSlugs');
    expect(from, 'the category apply block is still here').toBeGreaterThan(-1);
    const applyBlock = src.slice(from, from + 700);
    expect(applyBlock).toMatch(/from\('thread_category'\)/);
    expect(applyBlock).toMatch(/workspace_id.*ctx\.workspaceId/);
  });
});

describe('nothing captured is silently dropped on the way back', () => {
  // The rule: every setting a template stores must be restored. These four
  // were the ones that were not — two never captured, two captured and
  // ignored. Named individually because the rule cannot be checked
  // mechanically against a jsonb blob.
  for (const field of ['facilitation_language', 'public_scope']) {
    it(`${field} is captured AND applied`, () => {
      expect(carried(field), `${field} must be in TEMPLATE_THREAD.carry, written and read through the spec`).toBe(true);
    });
  }

  it('and the settings that already worked still do', () => {
    for (const field of ['cover_url', 'requires_approval', 'capacity', 'certificate_enabled', 'rsvp_enabled', 'enrolment_note']) {
      expect(carried(field), field).toBe(true);
    }
  });
});
