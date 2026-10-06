'use client';

import Link from 'next/link';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TextField } from '@/components/ui/field';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';
import { NOTICE, PILL, PILL_TONE, INSET, type PillTone } from '@thefibre/shared/ui/recipes';
import { saveWorkspace, startSenderDomain, checkSenderDomain, removeSenderDomain } from '../actions';
import { t, type Locale, type UiKey } from '@/lib/i18n-ui';

export type DnsRecord = {
  record: string;
  name: string;
  full_name: string;
  type: string;
  value: string;
  priority?: number;
  ttl?: string;
  status: string;
};

export type DomainState = {
  email: {
    id: string;
    host: string;
    status: string;
    verified_at: string | null;
    checked_at: string | null;
    records: DnsRecord[];
  } | null;
  can_sender_domain: boolean;
  can_web_domain: boolean;
  provider_configured: boolean;
};

export type WorkspaceSender = {
  email_from_name: string | null;
  email_from_address: string | null;
  email_reply_to: string | null;
  editable: boolean;
};

/** The provider's words → a tone and a sentence. Unknown words stay neutral
 *  rather than crashing the page: the provider may add a state. */
function statusView(status: string): { tone: PillTone; key: UiKey } {
  switch (status) {
    case 'verified':
      return { tone: 'positive', key: 'domain_status_verified' };
    case 'pending':
      return { tone: 'attention', key: 'domain_status_pending' };
    case 'failed':
    case 'temporary_failure':
      return { tone: 'negative', key: 'domain_status_failed' };
    default:
      return { tone: 'neutral', key: 'domain_status_not_started' };
  }
}

function domainOf(address: string | null): string | null {
  const m = /^[^@\s]+@([^@\s]+)$/.exec((address ?? '').trim());
  return m ? m[1]!.toLowerCase() : null;
}

/** One value on the clipboard, with a moment of "Copied". */
function CopyButton({ value, locale }: { value: string; locale: Locale }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? t(locale, 'domain_copied') : t(locale, 'domain_copy')}
    </Button>
  );
}

export function DomainForm({ domain, sender, locale }: { domain: DomainState; sender: WorkspaceSender; locale: Locale }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const email = domain.email;
  const canEdit = sender.editable && domain.can_sender_domain && domain.provider_configured;

  if (!domain.can_sender_domain) {
    return (
      <div className={`mt-8 max-w-xl ${NOTICE.info}`}>
        <p>{t(locale, 'domain_needs_plan')}</p>
        <p className="mt-2">
          <Link href="/settings/plan" className="underline">
            {t(locale, 'domain_plan_link')}
          </Link>
        </p>
      </div>
    );
  }

  function run(label: string, action: () => Promise<{ ok?: boolean; error?: string | undefined }>) {
    setError(null);
    setNotice(null);
    start(async () => {
      const r = await action();
      if (!r.ok) return setError(r.error ?? t(locale, 'could_not_save'));
      setNotice(label);
      router.refresh();
    });
  }

  function onStart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const value = String(fd.get('domain') ?? '').trim();
    if (!value) return setError(t(locale, 'domain_field_hint'));
    run(t(locale, 'saved_notice'), () => startSenderDomain(value));
  }

  function onSaveSender(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? '').trim();
    run(t(locale, 'saved_notice'), () =>
      saveWorkspace({
        email_from_address: str('email_from_address') || null,
        email_reply_to: str('email_reply_to') || null,
      }),
    );
  }

  const addressHost = domainOf(sender.email_from_address);
  const mismatch = email && addressHost && addressHost !== email.host;
  const status = email ? statusView(email.status) : null;

  return (
    <div className="mt-8 space-y-10 max-w-2xl">
      <section className="space-y-6">
        <SectionLabel>{t(locale, 'domain_sender_section')}</SectionLabel>
        {!domain.provider_configured && <p className={NOTICE.warning}>{t(locale, 'domain_not_configured')}</p>}

        {!email ? (
          <form onSubmit={onStart} className="space-y-6">
            <TextField
              label={t(locale, 'domain_field_label')}
              name="domain"
              placeholder="yourdomain.com"
              hint={t(locale, 'domain_field_hint')}
              autoComplete="off"
            />
            <Button type="submit" disabled={pending || !canEdit}>
              {pending ? t(locale, 'saving') : t(locale, 'domain_register')}
            </Button>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{email.host}</span>
              {status && <span className={`${PILL} ${PILL_TONE[status.tone]}`}>{t(locale, status.key)}</span>}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending || !canEdit}
                onClick={() => run(t(locale, 'domain_checked_notice'), () => checkSenderDomain())}
              >
                {pending ? t(locale, 'domain_checking') : t(locale, 'domain_check')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending || !canEdit}
                onClick={() => {
                  if (window.confirm(t(locale, 'domain_remove_confirm'))) run(t(locale, 'domain_removed_notice'), () => removeSenderDomain());
                }}
              >
                {t(locale, 'domain_remove')}
              </Button>
            </div>
            <p className="text-sm text-ink-subtle">
              {t(locale, email.status === 'verified' ? 'domain_verified_note' : 'domain_unverified_note')}
            </p>

            <div className={`${INSET} overflow-x-auto`}>
              <p className="px-4 pt-3 text-sm text-ink-subtle">{t(locale, 'domain_records_intro')}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted">
                    <th className="px-4 py-2 font-medium">{t(locale, 'domain_record_type')}</th>
                    <th className="px-4 py-2 font-medium">{t(locale, 'domain_record_name')}</th>
                    <th className="px-4 py-2 font-medium">{t(locale, 'domain_record_value')}</th>
                    <th className="px-4 py-2 font-medium">{t(locale, 'domain_record_status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {email.records.map((r, i) => {
                    const s = statusView(r.status);
                    return (
                      <tr key={`${r.type}-${r.name}-${i}`} className="border-t border-line align-top">
                        <td className="px-4 py-3 whitespace-nowrap">
                          {r.type}
                          {typeof r.priority === 'number' && <span className="block text-xs text-ink-muted">prio {r.priority}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <code className="break-all text-xs">{r.full_name}</code>
                            <CopyButton value={r.full_name} locale={locale} />
                          </div>
                          {r.name !== r.full_name && <span className="block text-xs text-ink-muted">({r.name})</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            <code className="break-all text-xs">{r.value}</code>
                            <CopyButton value={r.value} locale={locale} />
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`${PILL} ${PILL_TONE[s.tone]}`}>{t(locale, s.key)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="space-y-6 border-t border-line pt-8">
        <SectionLabel>{t(locale, 'email_label')}</SectionLabel>
        <form onSubmit={onSaveSender} className="space-y-6">
          <TextField
            label={t(locale, 'sender_address')}
            name="email_from_address"
            defaultValue={sender.email_from_address ?? ''}
            placeholder={email ? `hello@${email.host}` : 'hello@yourdomain.com'}
            hint={mismatch ? t(locale, 'domain_address_mismatch') : t(locale, 'domain_sender_address_hint')}
          />
          <TextField
            label={t(locale, 'replies_go_to')}
            name="email_reply_to"
            defaultValue={sender.email_reply_to ?? ''}
            placeholder="hello@yourdomain.com"
            hint={t(locale, 'domain_reply_to_hint')}
          />
          <Button type="submit" disabled={pending || !sender.editable}>
            {pending ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </form>
      </section>

      <section className="space-y-3 border-t border-line pt-8">
        <SectionLabel>{t(locale, 'domain_web_section')}</SectionLabel>
        <p className={NOTICE.info}>{t(locale, domain.can_web_domain ? 'domain_web_soon' : 'domain_web_enterprise')}</p>
      </section>

      {error && <p className={NOTICE.error}>{error}</p>}
      {notice && !error && <p className="text-sm text-ink-subtle">{notice}</p>}
      {!sender.editable && <p className="text-sm text-ink-subtle">{t(locale, 'admin_only_change')}</p>}
    </div>
  );
}
