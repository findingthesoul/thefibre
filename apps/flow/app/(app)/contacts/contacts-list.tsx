'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { RunModal } from '../flows/[id]/run-modal';

type Person = { id: string; first_name: string | null; last_name: string | null; email: string | null };
export type Run = {
  id: string;
  status: string;
  person: Person | Person[] | null;
  flow: { id: string; name: string } | { id: string; name: string }[] | null;
  step: { key: string; name: string; kind: string } | { key: string; name: string; kind: string }[] | null;
};

function one<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? v[0] ?? null : v;
}
function personName(p: Person | null): string {
  if (!p) return 'Unknown';
  return [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Unknown';
}

export function ContactsList({ runs }: { runs: Run[] }) {
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  return (
    <div className="mt-8 space-y-2">
      {runs.map((r) => {
        const person = one(r.person);
        const flow = one(r.flow);
        const step = one(r.step);
        return (
          <button
            key={r.id}
            onClick={() => setOpenRunId(r.id)}
            className="w-full text-left flex items-center gap-3 rounded-xl bg-white ring-1 ring-black/5 shadow-sm hover:shadow-md transition-shadow px-4 py-3"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium shrink-0">
              {((person?.first_name?.[0] ?? '') + (person?.last_name?.[0] ?? '') || '?').toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{personName(person)}</div>
              <div className="text-xs text-ink-muted truncate">{flow?.name}</div>
            </div>
            <div className="text-sm text-ink-subtle shrink-0">{step?.name ?? '—'}</div>
            <ChevronRight size={16} className="text-ink-muted shrink-0" />
          </button>
        );
      })}
      {openRunId && <RunModal runId={openRunId} onClose={() => setOpenRunId(null)} />}
    </div>
  );
}
