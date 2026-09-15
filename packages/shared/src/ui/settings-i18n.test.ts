// Every platform settings key has its title and description in the server
// chrome catalog, in every locale. platformSettings() builds the catalog key
// from the setting key with a cast, so the type system cannot see a missing
// pair — v0.78.0 added 'assistant' to the component and not to the catalog,
// and /settings threw a server-side exception in every locale on staging.
import { describe, expect, it } from 'vitest';
import { LOCALES } from '../i18n.js';
import { serverChromeT, type ServerChromeKey } from './chrome-server-i18n.js';
import { PLATFORM_SETTING_KEYS } from './settings.js';

describe('platform settings keys have their chrome strings', () => {
  for (const key of PLATFORM_SETTING_KEYS) {
    for (const suffix of ['title', 'desc'] as const) {
      it(`st_${key}_${suffix} exists in every locale`, () => {
        for (const locale of LOCALES) {
          const text = serverChromeT(locale, `st_${key}_${suffix}` as ServerChromeKey);
          expect(typeof text, `${locale}`).toBe('string');
          expect(text.length, `${locale}`).toBeGreaterThan(0);
        }
      });
    }
  }
});
