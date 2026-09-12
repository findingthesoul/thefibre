// public/sw.js, loaded as-is into a simulated worker.
//
// A service worker is the riskiest file in the app: a broken one stays on
// somebody's phone until it updates, and it sits between them and every page.
// So its routing decisions are tested against the REAL file — what it
// intercepts, what it leaves alone, and above all what it must never cache.

import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SOURCE = fs.readFileSync(path.resolve(__dirname, '../public/sw.js'), 'utf8');
const ORIGIN = 'https://connections.thefibre.tech';

type Listener = (event: any) => void;

function makeWorker(network: (req: Request) => Promise<Response>) {
  const listeners: Record<string, Listener> = {};
  const store = new Map<string, Map<string, Response>>();

  const caches = {
    open: async (name: string) => {
      if (!store.has(name)) store.set(name, new Map());
      const bucket = store.get(name)!;
      return {
        match: async (req: Request | string) => bucket.get(typeof req === 'string' ? req : req.url)?.clone(),
        put: async (req: Request | string, res: Response) => {
          bucket.set(typeof req === 'string' ? req : req.url, res);
        },
        addAll: async (urls: string[]) => {
          for (const u of urls) bucket.set(u, new Response(`precached ${u}`));
        },
      };
    },
    match: async (key: string) => {
      for (const bucket of store.values()) {
        const hit = bucket.get(key);
        if (hit) return hit.clone();
      }
      return undefined;
    },
    keys: async () => [...store.keys()],
    delete: async (name: string) => store.delete(name),
  };

  const self = {
    location: { origin: ORIGIN },
    addEventListener: (type: string, fn: Listener) => {
      listeners[type] = fn;
    },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
    registration: {},
  };

  // eslint-disable-next-line no-new-func
  new Function('self', 'caches', 'fetch', SOURCE)(self, caches, network);

  /** Dispatch a fetch; returns the response it chose, or null if it did not intercept. */
  async function dispatch(req: Request, mode: RequestMode = 'cors'): Promise<Response | null> {
    Object.defineProperty(req, 'mode', { value: mode });
    // Held in an object rather than a `let`: TypeScript cannot see that the
    // callback assigns a local, narrows it to `null`, and then calls the later
    // read `never`. The tests ran; the release gate's typecheck did not.
    const box: { p: Promise<Response> | null } = { p: null };
    listeners.fetch!({ request: req, respondWith: (p: Promise<Response>) => (box.p = p) });
    return box.p ? await box.p : null;
  }

  async function lifecycle(type: 'install' | 'activate') {
    let wait: Promise<unknown> = Promise.resolve();
    listeners[type]!({ waitUntil: (p: Promise<unknown>) => (wait = p) });
    await wait;
  }

  return { dispatch, lifecycle, store };
}

let fetched: string[];
const ok = (body = 'from network') =>
  vi.fn(async (req: Request) => {
    fetched.push(req.url);
    return new Response(body, { status: 200 });
  });
const offline = () =>
  vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });

beforeEach(() => {
  fetched = [];
});

describe('what the service worker leaves alone', () => {
  it('never intercepts a POST — server actions go straight to the server', async () => {
    const w = makeWorker(ok());
    expect(await w.dispatch(new Request(`${ORIGIN}/today`, { method: 'POST' }), 'navigate')).toBeNull();
  });

  it('never intercepts another origin — the API lives elsewhere', async () => {
    const w = makeWorker(ok());
    expect(await w.dispatch(new Request('https://thefibre-api.fly.dev/api/v1/notes'))).toBeNull();
  });

  it('never answers a router (RSC) request, which must not receive HTML', async () => {
    const w = makeWorker(offline());
    const rsc = new Request(`${ORIGIN}/people`, { headers: { RSC: '1' } });
    expect(await w.dispatch(rsc, 'navigate')).toBeNull();
    expect(await w.dispatch(new Request(`${ORIGIN}/people?_rsc=abc`), 'navigate')).toBeNull();
  });
});

describe('page loads', () => {
  it('uses the network when there is one', async () => {
    const w = makeWorker(ok('the real page'));
    const res = await w.dispatch(new Request(`${ORIGIN}/today`), 'navigate');
    expect(await res!.text()).toBe('the real page');
  });

  it('falls back to the offline page when the network fails', async () => {
    const w = makeWorker(offline());
    await w.lifecycle('install');
    const res = await w.dispatch(new Request(`${ORIGIN}/today`), 'navigate');
    expect(await res!.text()).toBe('precached /offline.html');
  });

  it('NEVER caches a signed-in page', async () => {
    // Every page is rendered for one person, full of names and notes. A cached
    // copy would outlive sign-out and show yesterday's data as current.
    const w = makeWorker(ok('Wilma Doornbos, three notes'));
    await w.dispatch(new Request(`${ORIGIN}/people/abc`), 'navigate');
    for (const bucket of w.store.values()) {
      expect([...bucket.keys()].some((k) => k.includes('/people/'))).toBe(false);
    }
  });
});

describe('the app code', () => {
  it('caches /_next/static files and serves them from cache afterwards', async () => {
    const net = ok('chunk');
    const w = makeWorker(net);
    const url = `${ORIGIN}/_next/static/chunks/app-abc123.js`;
    await w.dispatch(new Request(url));
    await w.dispatch(new Request(url));
    expect(fetched.filter((u) => u === url)).toHaveLength(1);
  });
});

describe('updates', () => {
  it('removes its own old caches on activate and leaves other caches alone', async () => {
    const w = makeWorker(ok());
    w.store.set('connections-shell-v0', new Map());
    w.store.set('someone-elses-cache', new Map());
    await w.lifecycle('activate');
    expect(w.store.has('connections-shell-v0')).toBe(false);
    expect(w.store.has('someone-elses-cache')).toBe(true);
  });
});
