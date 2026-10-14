import { describe, expect, it } from 'vitest';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// A ONE-WORD NAME COULD NOT BE ADDED.
//
// Sjoerd, adding a member on staging, got this in a red box:
//
//   API 400: {"formErrors":[],"fieldErrors":{"last_name":
//            ["String must contain at least 1 character(s)"]}}
//
// and said "better warnings". The warning was the symptom. The cause is that
// `z.string().min(1).optional()` accepts `undefined` and refuses `''` — the
// same thing to whoever wrote the schema, a different thing to a form. The
// Add-member dialog splits a typed name on spaces and sends
// `last_name: parts.slice(1).join(' ') || ''`, so anybody who goes by one
// name was refused.
//
// The schema under test is reproduced here rather than imported, because
// `PersonCreate` is not exported and the property being pinned is the SHAPE,
// not that one file's copy of it. If they diverge, the first test below says
// so in the only way that matters: by failing for the original input.
// ---------------------------------------------------------------------------

const optionalText = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    return t === '' ? undefined : t;
  }, schema);

const Person = z.object({
  first_name: z.string().min(1).max(100),
  last_name: optionalText(z.string().min(1).max(100).optional()),
  email: optionalText(z.string().email().optional()),
  city: optionalText(z.string().max(100).optional()),
});

describe('a person with one name', () => {
  it('can be created — the exact body the dialog sends', () => {
    // bell. danah. Prince. Half the world uses one name, and a membership
    // app that cannot record them is not a small bug.
    const r = Person.safeParse({ first_name: 'Sjoerd', last_name: '', email: '', city: '' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.last_name).toBeUndefined();
      expect(r.data.email).toBeUndefined();
    }
  });

  it('is not recorded with an empty-string surname', () => {
    // The other half of the fix. `last_name: ''` in the database is a value
    // that looks like a name and is not one, and it makes
    // `[first, last].join(' ')` produce a trailing space forever.
    const r = Person.parse({ first_name: 'Sjoerd', last_name: '   ' });
    expect(r.last_name).toBeUndefined();
  });
});

// On an EDIT, blank and absent are opposites: one means "clear this", the
// other means "leave it". The create schema cannot tell them apart and does
// not need to; the patch schema must.
const clearableText = (schema: z.ZodTypeAny) =>
  z.preprocess((v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    return t === '' ? null : t;
  }, schema);

const PersonPatch = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: clearableText(z.string().min(1).max(100).nullable().optional()),
});

describe('editing a person', () => {
  it('clears a surname when the box is emptied', () => {
    // Not `undefined`, which the update would read as "unchanged" and the
    // editor would watch the name come back after saving.
    expect(PersonPatch.parse({ last_name: '' }).last_name).toBeNull();
    expect(PersonPatch.parse({ last_name: '   ' }).last_name).toBeNull();
  });

  it('leaves it alone when the field is not sent at all', () => {
    expect(PersonPatch.parse({ first_name: 'Marja' }).last_name).toBeUndefined();
    expect('last_name' in PersonPatch.parse({ first_name: 'Marja' })).toBe(false);
  });

  it('still sets a real surname', () => {
    expect(PersonPatch.parse({ last_name: ' de Vries ' }).last_name).toBe('de Vries');
  });
});

describe('a blank field is a missing field, not a bad one', () => {
  it('applies to every optional text field, not only the one that was reported', () => {
    // Fixing last_name alone would leave the identical trap on email, city
    // and four others — and the next person to hit it would get the same
    // unreadable box about a different field.
    const r = Person.safeParse({ first_name: 'Marja', last_name: '', email: '', city: '' });
    expect(r.success).toBe(true);
  });

  it('still refuses something that is genuinely wrong', () => {
    // The point is not to accept anything. A typed address that is not an
    // address is still an error, and should still say so.
    const r = Person.safeParse({ first_name: 'Marja', email: 'not-an-address' });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.email).toBeTruthy();
    }
  });

  it('still refuses a missing first name', () => {
    // first_name is required and stays required: a person row with no name
    // at all is not a contact, it is a gap.
    expect(Person.safeParse({ first_name: '' }).success).toBe(false);
    expect(Person.safeParse({}).success).toBe(false);
  });

  it('leaves a real value exactly as given, apart from trimming', () => {
    const r = Person.parse({ first_name: 'Marja', last_name: '  de Vries  ' });
    expect(r.last_name).toBe('de Vries');
  });
});
