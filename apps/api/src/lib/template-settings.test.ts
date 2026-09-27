import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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
// These read the source. Capture and apply are two lists in two functions
// that have to agree, and nothing in the type system says so: every field is
// `unknown` on its way through jsonb. That is exactly how they drifted.
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
  const at = src.indexOf("from('thread_thread')\n    .insert({\n      workspace_id: ctx.workspaceId,\n      program_id: program.id,\n      organiser_id: organiser.id,\n      slug: body.data.slug,\n      intention: (st.intention");
  expect(at, 'the create-from-template insert is still here').toBeGreaterThan(-1);
  return src.slice(at, src.indexOf('.select(', at));
})();

describe('a template carries what a thread charges', () => {
  it('captures tickets, which ARE the price when a thread has them', () => {
    expect(structure).toMatch(/tickets:/);
    expect(structure).toMatch(/price_cents/);
  });

  it('does not carry a ticket sales deadline', () => {
    // An absolute date belonging to one run. A template applied three months
    // later would arrive with a deadline already past and a ticket nobody can
    // buy — the failure would look like "the template is broken".
    expect(structure).not.toMatch(/available_until:/);
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
      expect(structure, `${field} missing from the template`).toContain(field);
      expect(applied, `${field} captured but dropped when applied`).toContain(field);
    });
  }

  it('and the settings that already worked still do', () => {
    for (const field of ['cover_url', 'requires_approval', 'capacity', 'certificate_enabled']) {
      expect(structure).toContain(field);
      expect(applied).toContain(field);
    }
  });
});
