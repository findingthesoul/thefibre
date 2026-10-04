import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// The editor was Thread's. The profile bio needed the same one, and the rule
// here is that a surface which exists anywhere gets extracted rather than
// copied — a fork drifts, and then one app's bold button behaves differently
// from another's for reasons nobody can find.
//
// So Thread's path still works and holds no implementation, and the labels
// live in the shared catalog rather than in each app's.

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('one editor, not one per app', () => {
  it("Thread's file is a shim with no implementation left in it", () => {
    const shim = read('../../../../apps/thread/components/ui/rich-text.tsx');
    expect(shim).toContain("export { RichTextField } from '@thefibre/shared/ui/rich-text-field'");
    // The giveaways of a re-forked copy.
    expect(shim).not.toContain('document.execCommand');
    expect(shim).not.toContain('contentEditable');
  });

  it('the profile form uses it, so the bio is edited like every other rich text', () => {
    const form = read('./profile-form.tsx');
    expect(form).toContain('<RichTextField');
    // Seeded through bioToHtml: dropping a plain bio straight into an HTML
    // editor loses every line break the person typed.
    expect(form).toContain('bioToHtml(initial.bio)');
  });

  it('every toolbar label exists in the shared catalog, in all six locales', () => {
    // A missing key is a button labelled with its own key name, which reads
    // as a typo rather than as a missing translation.
    const catalog = read('./i18n-ui.tsx');
    for (const key of [
      'heading',
      'bold',
      'italic',
      'bullet_list',
      'numbered_list',
      'rt_link',
      'clear_formatting',
      'link_url',
    ]) {
      const entry = catalog.match(new RegExp(`\\n  ${key}: \\{([\\s\\S]*?)\\n  \\}`));
      expect(entry, `${key} missing from the chrome catalog`).not.toBeNull();
      for (const locale of ['en', 'nl', 'es', 'pt', 'de', 'fr']) {
        expect(entry![1], `${key} has no ${locale}`).toContain(`${locale}:`);
      }
    }
  });
});
