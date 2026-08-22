'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { mintKey, revokeKey } from './actions';

export type KeyRow = {
  id: string;
  name: string | null;
  token_prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function when(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export function KeyManager({
  slug,
  keys,
  availableScopes,
}: {
  slug: string;
  keys: KeyRow[];
  availableScopes: string[];
}) {
  const [name, setName] = useState('');
  const [chosen, setChosen] = useState<string[]>([]);
  const [minted, setMinted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function toggle(scope: string) {
    setChosen((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  function mint() {
    setError(null);
    setMinted(null);
    start(async () => {
      const r = await mintKey(slug, name.trim(), chosen);
      if (r.error) setError(r.error);
      else {
        setMinted(r.token ?? null);
        setName('');
        setChosen([]);
        router.refresh();
      }
    });
  }

  function revoke(id: string) {
    setError(null);
    start(async () => {
      const r = await revokeKey(slug, id);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  const live = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);

  return (
    <div className="space-y-10">
      {minted && (
        <div className="rounded-lg border border-line bg-surface-raised p-5">
          <div className="text-sm font-medium">Copy this token now</div>
          <p className="mt-1 text-sm text-ink-subtle">
            It is shown once and never again — only its hash is stored. Send it as{' '}
            <code className="font-mono text-xs">Authorization: Bearer …</code>; no{' '}
            <code className="font-mono text-xs">X-App-ID</code> header is needed, the key
            identifies the app.
          </p>
          <pre className="mt-3 overflow-x-auto rounded border border-line bg-surface p-3 font-mono text-xs">
            {minted}
          </pre>
        </div>
      )}

      <section>
        <div className="text-sm font-medium">New key</div>
        <p className="mt-1 text-sm text-ink-subtle max-w-2xl">
          A key acts for this app in this workspace only, and only within the scopes you
          tick. It carries none of your own authority — that is the point of it.
        </p>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-ink-muted">
              Label (optional)
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Production sync"
              className="mt-1 block w-full max-w-md rounded border border-line bg-surface px-3 py-2 text-sm"
            />
          </label>

          <div>
            <span className="text-[10px] uppercase tracking-wider text-ink-muted">Scopes</span>
            {availableScopes.length === 0 ? (
              <p className="mt-1 text-sm text-ink-subtle">
                This app's manifest requested no recognised scopes, so there is nothing a key
                could be allowed to do. Ask the developer to declare{' '}
                <code className="font-mono text-xs">scopes_requested</code> and re-register.
              </p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {availableScopes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggle(s)}
                    className={
                      chosen.includes(s)
                        ? 'rounded border border-ink px-2 py-1 font-mono text-[11px]'
                        : 'rounded border border-line px-2 py-1 font-mono text-[11px] text-ink-subtle hover:text-ink'
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button onClick={mint} disabled={pending || chosen.length === 0}>
            {pending ? 'Working…' : 'Mint key'}
          </Button>
          {error && <div className="text-xs text-red-700">{error}</div>}
        </div>
      </section>

      <section>
        <div className="text-sm font-medium">Active keys</div>
        {live.length === 0 ? (
          <p className="mt-2 text-sm text-ink-subtle">None.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
            {live.map((k) => (
              <li key={k.id} className="flex items-start justify-between gap-6 p-4">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-3">
                    <span className="font-medium text-sm">{k.name ?? 'Unnamed key'}</span>
                    <span className="font-mono text-xs text-ink-muted">{k.token_prefix}…</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {k.scopes.map((s) => (
                      <span
                        key={s}
                        className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-ink-subtle"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-ink-muted">
                    Created {when(k.created_at)}
                    {k.last_used_at ? ` · last used ${when(k.last_used_at)}` : ' · never used'}
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => revoke(k.id)} disabled={pending}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {revoked.length > 0 && (
        <section>
          <div className="text-sm font-medium">Revoked</div>
          <ul className="mt-3 space-y-1">
            {revoked.map((k) => (
              <li key={k.id} className="text-sm text-ink-muted">
                <span className="font-mono text-xs">{k.token_prefix}…</span>{' '}
                {k.name ?? 'Unnamed key'} — revoked {when(k.revoked_at)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
