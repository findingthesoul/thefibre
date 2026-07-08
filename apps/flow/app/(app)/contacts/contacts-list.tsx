'use client';

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { RunModal } from '../flows/[id]/run-modal';
import {
  one,
  runSubjectName,
  runSubjectInitials,
  isPulseRun,
  PULSE_BADGE_TITLE,
  type RunPerson as Person,
  type RunOrganisation,
} from '@/lib/run-subject';

export type Run = {
  id: string;
  status: string;
  person: Person | Person[] | null;
  organisation?: RunOrganisation | RunOrganisation[] | null;
  subject_label?: string | null;
  source_app?: string | null;
  flow: { id: string; name: string } | { id: string; name: string }[] | null;
  step: { key: string; name: string; kind: string } | { key: string; name: string; kind: string }[] | null;
};

export function ContactsList({ runs }: { runs: Run[] }) {
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  return (
    <div className="mt-8 space-y-2">
      {runs.map((r) => {
        const flow = one(r.flow);
        const step = one(r.step);
        return (
          <button
            key={r.id}
            onClick={() => setOpenRunId(r.id)}
            className="w-full text-left flex items-center gap-3 rounded-xl bg-white ring-1 ring-black/5 shadow-card hover:shadow-card-hover transition-shadow px-4 py-3"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 text-indigo-600 text-xs font-medium shrink-0">
              {runSubjectInitials(r)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="font-medium truncate">{runSubjectName(r)}</span>
                {isPulseRun(r) && (
                  <span
                    title={PULSE_BADGE_TITLE}
                    className="bg-yellow-100 text-ink text-[10px] rounded-full px-1.5 py-0.5 shrink-0"
                  >
                    Pulse
                  </span>
                )}
              </div>
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
