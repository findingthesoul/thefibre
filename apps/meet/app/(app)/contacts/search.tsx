'use client';

import { useState, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function ContactsSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(initial);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = q.trim();
    startTransition(() => {
      router.push(next ? `${path}?q=${encodeURIComponent(next)}` : path);
    });
  }

  return (
    <form onSubmit={submit}>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, email, or company"
        className="w-full rounded-md border border-line bg-surface-raised px-4 py-3 text-sm focus:outline-none focus:border-line-strong"
      />
      {pending && (
        <div className="mt-1 text-xs text-ink-muted">Searching…</div>
      )}
    </form>
  );
}
