// The client-value guard (scripts/check-client-value-imports.mjs). It must
// refuse a server file that imports a VALUE from a 'use client' module —
// through a relative import AND through the app alias `@/` (to a file or a
// directory index) — and must leave components, hooks, types and plain
// modules alone. A fake app in memory, so each case says exactly what it
// plants.

import { describe, expect, it } from 'vitest';
import { offenders } from './check-client-value-imports.mjs';

const ROOT = '/repo/apps/demo';
function fs(files) {
  const map = new Map(Object.entries(files).map(([k, v]) => [`${ROOT}/${k}`, v]));
  map.set(`${ROOT}/tsconfig.json`, '{ "compilerOptions": { "paths": { "@/*": ["./*"] } } }');
  return { read: (p) => { if (!map.has(p)) throw new Error(`ENOENT ${p}`); return map.get(p); }, exists: (p) => map.has(p), list: [...map.keys()].filter((k) => /\.tsx?$/.test(k)) };
}
const CLIENT_MOD = "'use client';\nexport const TABS = ['a', 'b'];\nexport function Tabs() { return null; }\nexport function useTabs() {}\nexport type Tab = string;";

describe('client-value guard', () => {
  it('refuses a RELATIVE value import from a client module', () => {
    const f = fs({ 'app/page.tsx': "import { TABS } from './tabs';", 'app/tabs.tsx': CLIENT_MOD });
    expect(offenders(f.list, f.read, f.exists)).toEqual([`${ROOT}/app/page.tsx imports TABS from the client module ./tabs`]);
  });

  it('refuses an @/ value import (the alias, 2026-10-17)', () => {
    const f = fs({ 'app/x/page.tsx': "import { TABS, Tabs } from '@/components/tabs';", 'components/tabs.tsx': CLIENT_MOD });
    expect(offenders(f.list, f.read, f.exists)).toEqual([`${ROOT}/app/x/page.tsx imports TABS from the client module @/components/tabs`]);
  });

  it('refuses an @/ import that resolves to a DIRECTORY index', () => {
    const f = fs({ 'app/page.tsx': "import { TABS } from '@/lib/tabs';", 'lib/tabs/index.ts': CLIENT_MOD });
    expect(offenders(f.list, f.read, f.exists)).toEqual([`${ROOT}/app/page.tsx imports TABS from the client module @/lib/tabs`]);
  });

  it('allows components, hooks and types from a client module', () => {
    const f = fs({ 'app/page.tsx': "import { Tabs, useTabs, type Tab } from '@/components/tabs';", 'components/tabs.tsx': CLIENT_MOD });
    expect(offenders(f.list, f.read, f.exists)).toEqual([]);
  });

  it('allows any value from a PLAIN module, and any import inside a client file', () => {
    const f = fs({
      'app/page.tsx': "import { TABS } from '@/lib/tabs';",
      'lib/tabs.ts': "export const TABS = ['a'];",
      'app/bar.tsx': "'use client';\nimport { TABS } from '@/components/tabs';",
      'components/tabs.tsx': CLIENT_MOD,
    });
    expect(offenders(f.list, f.read, f.exists)).toEqual([]);
  });

  it('ignores package imports and unresolved paths rather than guessing', () => {
    const f = fs({ 'app/page.tsx': "import { TABS } from '@thefibre/shared/ui/tabs';\nimport { X } from '@/missing';" });
    expect(offenders(f.list, f.read, f.exists)).toEqual([]);
  });
});
