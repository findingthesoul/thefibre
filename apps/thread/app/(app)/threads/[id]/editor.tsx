'use client';

import { useState } from 'react';
import type { ThreadRow, EngagementRow } from '@/lib/thread-types';
import { ThreadEditorForm } from './form';
import { EngagementsPanel } from './engagements';

type Tab = 'basics' | 'engagements';

// Meet's tabbed-editor pattern: all tabs stay in the DOM, CSS hides the
// inactive ones — form state survives tab switches.
export function ThreadEditor({
  thread,
  engagements,
}: {
  thread: ThreadRow;
  engagements: EngagementRow[];
}) {
  const [tab, setTab] = useState<Tab>('basics');

  const tabs: { value: Tab; label: string }[] = [
    { value: 'basics', label: 'Basics' },
    { value: 'engagements', label: `Engagements${engagements.length ? ` (${engagements.length})` : ''}` },
  ];

  return (
    <div>
      <nav className="mt-6 border-b border-line">
        <ul className="flex gap-1 -mb-px overflow-x-auto">
          {tabs.map((t) => (
            <li key={t.value}>
              <button
                type="button"
                onClick={() => setTab(t.value)}
                className={`inline-block px-3 py-2 text-sm border-b-2 transition-colors ${
                  tab === t.value
                    ? 'border-ink text-ink'
                    : 'border-transparent text-ink-subtle hover:text-ink hover:border-line-strong'
                }`}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className={tab === 'basics' ? '' : 'hidden'}>
        <ThreadEditorForm thread={thread} />
      </div>
      <div className={`mt-8 ${tab === 'engagements' ? '' : 'hidden'}`}>
        <EngagementsPanel threadId={thread.id} engagements={engagements} />
      </div>
    </div>
  );
}
