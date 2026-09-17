'use client';

// The Thread's mount of the shared assistant panel. Labels come from the
// signed-in catalog (lib/i18n-ui.ts), the transport is a server action, and
// "Open the thread" is a client-side navigation.

import { useRouter } from 'next/navigation';
import { AssistantPanel, type AssistantRequest } from '@thefibre/shared/ui/assistant';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { assistantChat } from '@/lib/assistant-actions';

export function ThreadAssistant({ locale }: { locale: Locale }) {
  const router = useRouter();
  return (
    <AssistantPanel
      send={(req: AssistantRequest) => assistantChat(req, locale)}
      onNavigate={(path) => router.push(path)}
      suggestions={[t(locale, 'assistant_suggest_template'), t(locale, 'assistant_suggest_status')]}
      labels={{
        open: t(locale, 'assistant_open'),
        title: t(locale, 'assistant_title'),
        intro: t(locale, 'assistant_intro'),
        placeholder: t(locale, 'assistant_placeholder'),
        send: t(locale, 'assistant_send'),
        thinking: t(locale, 'assistant_thinking'),
        proposalTitle: t(locale, 'assistant_proposal'),
        approve: t(locale, 'assistant_approve'),
        decline: t(locale, 'assistant_decline'),
        newChat: t(locale, 'assistant_new_chat'),
        close: t(locale, 'assistant_close'),
        failed: t(locale, 'assistant_failed'),
        openThread: t(locale, 'assistant_open_thread'),
        // The chips substitute {title} themselves; t() leaves an unknown
        // placeholder untouched when no vars are passed.
        useTemplate: t(locale, 'assistant_use_template'),
        useThread: t(locale, 'assistant_use_thread'),
      }}
    />
  );
}
