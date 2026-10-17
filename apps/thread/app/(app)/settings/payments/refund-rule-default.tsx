'use client';

// The workspace's default refund rule (refund rules, slice 2): what a
// cancelled place gets back on every thread that has no rule of its own.
// Admins only — the page shows it to whoever may edit the workspace.

import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { SectionLabel } from '@/components/ui/page';
import { RefundRuleEditor, type RefundRule } from '@/components/refund-rule-editor';
import { updateWorkspaceSettings } from '../actions';

export function RefundRuleDefault({ locale, initial }: { locale: Locale; initial: RefundRule | null }) {
  return (
    <section>
      <SectionLabel>{t(locale, 'refund_rule_title')}</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle">{t(locale, 'refund_rule_workspace_hint')}</p>
      <div className="mt-3">
        <RefundRuleEditor
          locale={locale}
          scope="workspace"
          initial={initial}
          onSave={(rule) => updateWorkspaceSettings({ refund_rule: rule })}
        />
      </div>
    </section>
  );
}
