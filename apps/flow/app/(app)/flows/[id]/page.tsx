import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { uiLocale } from '@/lib/locale';
import { t, type UiKey } from '@/lib/i18n-ui';
import { FlowCanvas } from './flow-canvas';
import { FlowTabs } from './flow-tabs';
import { FlowReport } from './flow-report';
import { FlowLifecycleMenu } from './flow-lifecycle';
import { RunsPanel, type Run, type Step } from './runs-panel';

type Graph = {
  steps: unknown[];
  transitions: unknown[];
  step_default_tasks: unknown[];
};

type FlowDetail = {
  flow: {
    id: string;
    name: string;
    description: string | null;
    scope: string;
    lifecycle: 'draft' | 'active' | 'closed' | 'archived';
    progression: 'gated' | 'open' | null;
    current_version_id: string | null;
  };
  version: { id: string; version_number: number; published_at: string | null } | null;
  is_draft: boolean;
  graph: Graph;
};

const SCOPE_KEY: Record<string, UiKey> = {
  personal: 'scope_personal',
  team: 'scope_team',
  workspace: 'scope_workspace',
};

const LIFECYCLE_KEY: Record<string, UiKey> = {
  draft: 'lifecycle_draft',
  active: 'lifecycle_active',
  closed: 'lifecycle_closed',
  archived: 'lifecycle_archived',
};

export default async function FlowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locale = await uiLocale();
  let detail: FlowDetail;
  try {
    detail = await apiFetch<FlowDetail>(`/api/v1/flow/flows/${id}`);
  } catch {
    notFound();
  }

  const { flow, version, is_draft, graph } = detail;

  // Runs in this flow (best-effort — empty if the flow isn't published yet).
  let runs: Run[] = [];
  try {
    const r = await apiFetch<{ items: Run[] }>(`/api/v1/flow/flows/${id}/runs`);
    runs = r.items;
  } catch {
    runs = [];
  }
  const canAddContacts = !!flow.current_version_id && flow.lifecycle === 'active';

  return (
    <div className="px-6 py-10">
      <Link
        href="/flows"
        className="inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={16} /> {t(locale, 'flows')}
      </Link>

      <div className="mt-4 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-ink">{flow.name}</h1>
          {flow.description && (
            <p className="mt-1 text-sm text-ink-muted max-w-2xl">{flow.description}</p>
          )}
          <div className="mt-2 flex items-center gap-3 text-xs text-ink-muted">
            <span>{t(locale, SCOPE_KEY[flow.scope] ?? 'scope_personal')}</span>
            <span>·</span>
            <span>{t(locale, LIFECYCLE_KEY[flow.lifecycle] ?? 'lifecycle_draft')}</span>
            {flow.progression === 'open' && (
              <>
                <span>·</span>
                <span title={t(locale, 'self_paced_tooltip')}>{t(locale, 'self_paced')}</span>
              </>
            )}
            {version && (
              <>
                <span>·</span>
                <span>
                  v{version.version_number}
                  {is_draft ? ` ${t(locale, 'draft_suffix')}` : ''}
                </span>
              </>
            )}
          </div>
        </div>
        <FlowLifecycleMenu
          flowId={flow.id}
          lifecycle={flow.lifecycle}
          progression={flow.progression ?? 'gated'}
          activeRunCount={runs.filter((r) => r.status === 'active').length}
          locale={locale}
        />
      </div>

      <FlowTabs
        flowCount={runs.length}
        locale={locale}
        builder={
          <div className="mt-4">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            <FlowCanvas
              flowId={flow.id}
              flowName={flow.name}
              lifecycle={flow.lifecycle}
              initialGraph={graph as any}
              locale={locale}
            />
          </div>
        }
        flows={
          <div className="mt-2">
            <RunsPanel
              flowId={flow.id}
              runs={runs}
              steps={(graph.steps ?? []) as Step[]}
              canAdd={canAddContacts}
              locale={locale}
            />
          </div>
        }
        reports={<FlowReport runs={runs} steps={(graph.steps ?? []) as Step[]} locale={locale} />}
      />
    </div>
  );
}
