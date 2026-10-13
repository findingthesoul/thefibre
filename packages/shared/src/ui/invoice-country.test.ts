// The country on an invoice form is PICKED, never typed.
//
// It was a text input with `autoComplete="country-name"`, so people typed a
// name — which is what it asked for — and Stripe wants a two-letter code.
// Anything it could not read was dropped, silently: a Dutch joiner typing
// "Nederland" lost the country off their invoice and nothing said so. A
// resolver was added first, which only rescued the English spellings it knew;
// the real fault was asking for free text when the value must come from a
// fixed list.
//
// Read off the source, because this is about what the component IS — a
// rendering test would prove the picker renders, not that nobody reintroduced
// the text box beside it.

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { COUNTRIES } from '../countries.js';

const src = readFileSync(new URL('./payment-methods.tsx', import.meta.url), 'utf8');
const fields = src.slice(src.indexOf('export function InvoiceBillingFields'));

describe('the invoicing country field', () => {
  it('is a picker over the shared country list', () => {
    expect(fields).toContain('<SearchSelect');
    expect(fields).toContain("name=\"billing_country\"");
    expect(fields).toContain('options={COUNTRY_OPTIONS}');
  });

  // ⚠️ THE REGRESSION TO CATCH. `field('country', …)` is the helper that
  // renders a free-text input; the country must not go back through it.
  it('is not a free-text box asking for a name', () => {
    expect(fields, 'the country must not use the text-input helper').not.toContain(
      "field('country'",
    );
    // The ARGUMENT, not the word: the comment above the picker names the old
    // autocomplete hint in order to explain it, and a test that forbade the
    // string would forbid the explanation. (It caught exactly that on its
    // first run — the second time today, which is a fair sign the rule is
    // worth stating: assert on the code, not on the prose about it.)
    expect(fields, 'and must not ask the browser for a country NAME').not.toMatch(
      /autoComplete=["']country-name|,\s*['"]country-name['"]\s*\)/,
    );
  });

  it('posts codes, not names', () => {
    // The option list moved to countries.ts when the pricing picker and this
    // one stopped being two copies of the same map, so the assertion follows
    // it rather than being loosened to pass where it used to live.
    const list = readFileSync(new URL('../countries.ts', import.meta.url), 'utf8');
    expect(list).toContain('value: c.code, label: c.name');
    // Sorted BY NAME: the raw list is in ISO-code order, which opened the
    // dropdown on "Andorra, United Arab Emirates, Afghanistan" — no order at
    // all to somebody reading it.
    expect(list).toContain('a.name.localeCompare(b.name)');
    // The value is the code and the label is the name — the wrong way round
    // would post "Netherlands" and look identical on screen.
    const nl = COUNTRIES.find((c) => c.code === 'NL');
    expect(nl?.name, 'and the list is the one the API resolves against').toBe('Netherlands');
  });

  // Asking twice on one form is the kind of thing people notice.
  it('can be pre-filled from a country the form already knows', () => {
    expect(fields).toContain('defaultCountry');
    expect(fields).toContain('useState(defaultCountry)');
  });
});
