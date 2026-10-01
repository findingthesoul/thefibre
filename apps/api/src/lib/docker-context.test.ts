// The API image and its build context, held against the workspace.
//
// Two hand-written lists decide what the Fly builder sees, and both fail in a
// place no local command reaches:
//
//  - apps/api/Dockerfile COPYs each workspace package BY NAME. A new
//    `workspace:*` dependency builds here and dies in the Fly image with
//    "cannot find module" (v0.85.0, 2026-09-21 — fixed in v0.85.2).
//  - .dockerignore lists the sibling apps one by one. It stopped at the five
//    that existed in July, so five newer apps were uploaded to the builder on
//    every deploy until 2026-10-01.
//
// Neither is derivable at build time, so they are checked instead.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const read = (rel: string) => readFileSync(`${root}${rel}`, 'utf8');

const dockerfile = read('apps/api/Dockerfile');
const ignored = read('.dockerignore')
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith('#'));

/** package name → its folder under packages/ */
const packages = new Map<string, string>();
for (const dir of readdirSync(`${root}packages`, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const pkg = JSON.parse(read(`packages/${dir.name}/package.json`)) as { name: string };
  packages.set(pkg.name, dir.name);
}

function workspaceDeps(rel: string): string[] {
  const pkg = JSON.parse(read(rel)) as { dependencies?: Record<string, string> };
  return Object.entries(pkg.dependencies ?? {})
    .filter(([, v]) => v.startsWith('workspace:'))
    .map(([k]) => k);
}

/** The API's workspace dependencies, followed through their own. */
function closure(): string[] {
  const seen = new Set<string>();
  const queue = workspaceDeps('apps/api/package.json');
  while (queue.length) {
    const name = queue.pop()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const dir = packages.get(name);
    expect(dir, `${name} is a folder under packages/`).toBeTruthy();
    queue.push(...workspaceDeps(`packages/${dir}/package.json`));
  }
  return [...seen];
}

describe('the API image', () => {
  it('COPYs every workspace package the API depends on, manifest and source', () => {
    const deps = closure();
    // @thefibre/shared and @thefibre/mcp today. None found = the reader broke.
    expect(deps.length).toBeGreaterThanOrEqual(2);
    for (const name of deps) {
      const dir = packages.get(name)!;
      expect(dockerfile, `${name}: manifest`).toContain(`COPY packages/${dir}/package.json`);
      expect(dockerfile, `${name}: source`).toContain(`COPY packages/${dir}/src/ packages/${dir}/src/`);
    }
  });

  it('does not ignore anything it COPYs', () => {
    for (const m of dockerfile.matchAll(/^COPY (?!--from)(.+)$/gm)) {
      const sources = m[1]!.trim().split(/\s+/).slice(0, -1);
      for (const src of sources) {
        const hit = ignored.find((pattern) => {
          const p = pattern.replace(/\/$/, '');
          return !p.includes('*') && (src === p || src.startsWith(`${p}/`));
        });
        expect(hit, `${src} is COPYed but matches .dockerignore "${hit}"`).toBeUndefined();
      }
    }
  });
});

describe('the build context', () => {
  it('leaves every app except the API out of the upload', () => {
    const apps = readdirSync(`${root}apps`, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== 'api')
      .map((d) => d.name);
    // Ten Next apps today.
    expect(apps.length).toBeGreaterThanOrEqual(10);
    for (const app of apps) expect(ignored, `apps/${app}/`).toContain(`apps/${app}/`);
    expect(ignored).not.toContain('apps/api/');
  });

  it('never uploads an env file, from any folder', () => {
    for (const pattern of ['.env', '.env.*', '**/.env', '**/.env.*']) expect(ignored).toContain(pattern);
  });
});
