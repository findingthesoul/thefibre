'use client';

import { useState, type ReactNode } from 'react';
import { Workflow, Users } from 'lucide-react';

type Tab = 'builder' | 'flows';

export function FlowTabs({
  builder,
  flows,
  flowCount,
}: {
  builder: ReactNode;
  flows: ReactNode;
  flowCount: number;
}) {
  const [tab, setTab] = useState<Tab>('flows');

  return (
    <div className="mt-6">
      <div className="flex items-center gap-1 border-b border-line">
        <TabButton active={tab === 'flows'} onClick={() => setTab('flows')} icon={Users} count={flowCount}>
          Flows
        </TabButton>
        <TabButton active={tab === 'builder'} onClick={() => setTab('builder')} icon={Workflow}>
          Builder
        </TabButton>
      </div>

      {/* Both panes stay mounted (CSS-hidden) so unsaved canvas edits survive a
          tab switch. */}
      <div className={tab === 'builder' ? '' : 'hidden'}>{builder}</div>
      <div className={tab === 'flows' ? '' : 'hidden'}>{flows}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Workflow;
  count?: number;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
        active
          ? 'border-neutral-900 text-ink font-medium'
          : 'border-transparent text-ink-subtle hover:text-ink'
      }`}
    >
      <Icon size={16} strokeWidth={1.75} />
      {children}
      {count != null && count > 0 && (
        <span className="rounded-full bg-surface-sunken text-ink-subtle text-[11px] px-1.5 py-0.5 leading-none">
          {count}
        </span>
      )}
    </button>
  );
}
