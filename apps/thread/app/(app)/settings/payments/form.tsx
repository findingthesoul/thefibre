'use client';

// Two levels, one SPoT — the Stripe Connect account, the invoice issuer
// identity (legal name / address / tax no.) and, at personal level, the
// DEFAULT payment options that threads and tickets inherit.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateMyPayments,
  updateWorkspacePayments,
  type InvoiceDetails,
} from './actions';
import type { Locale } from '@thefibre/shared';
import { SectionLabel } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n-ui';

const INPUT =
  'mt-1 w-full max-w-md rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

export function PaymentsForm({
  locale,
  personalAccount,
  personalDetails,
  personalMethods,
  workspaceAccount,
  workspaceDetails,
  workspaceMethods,
  isAdmin,
}: {
  locale: Locale;
  personalAccount: string | null;
  personalDetails: InvoiceDetails | null;
  personalMethods: ('stripe' | 'invoice')[] | null;
  workspaceAccount: string | null;
  workspaceDetails: InvoiceDetails | null;
  workspaceMethods: ('stripe' | 'invoice')[] | null;
  isAdmin: boolean;
}) {
  return (
    <div className="mt-8 space-y-10">
      <AccountSection
        locale={locale}
        label={t(locale, 'my_account')}
        description={t(locale, 'my_account_desc')}
        initialAccount={personalAccount}
        initialDetails={personalDetails}
        initialMethods={personalMethods}
        showMethods
        save={(acct, details, methods) => updateMyPayments(acct, details, methods)}
      />
      <AccountSection
        locale={locale}
        label={t(locale, 'workspace_account')}
        description={t(locale, 'workspace_account_desc')}
        initialAccount={workspaceAccount}
        initialDetails={workspaceDetails}
        initialMethods={workspaceMethods}
        showMethods
        methodsHint={t(locale, 'methods_hint_workspace')}
        save={(acct, details, methods) => updateWorkspacePayments(acct, details, methods)}
        disabled={!isAdmin}
        disabledNote={t(locale, 'managed_by_admins')}
      />
      <p className="text-xs text-ink-muted max-w-xl leading-relaxed">
        {t(locale, 'stripe_note_1')} <code className="font-mono">acct_</code>{' '}
        {t(locale, 'stripe_note_2')}
      </p>
    </div>
  );
}

function AccountSection({
  locale,
  label,
  description,
  initialAccount,
  initialDetails,
  initialMethods,
  showMethods = false,
  methodsHint,
  save,
  disabled = false,
  disabledNote,
}: {
  locale: Locale;
  label: string;
  description: string;
  initialAccount: string | null;
  initialDetails: InvoiceDetails | null;
  initialMethods: ('stripe' | 'invoice')[] | null;
  showMethods?: boolean;
  methodsHint?: string;
  save: (
    accountId: string | null,
    details: InvoiceDetails | null,
    methods: ('stripe' | 'invoice')[] | null,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount ?? '');
  const [legalName, setLegalName] = useState(initialDetails?.legal_name ?? '');
  const [address, setAddress] = useState(initialDetails?.address ?? '');
  const [taxNo, setTaxNo] = useState(initialDetails?.tax_no ?? '');
  const [vatOn, setVatOn] = useState(initialDetails?.vat_registered ?? false);
  const [vatRate, setVatRate] = useState(
    initialDetails?.vat_rate_pct != null ? String(initialDetails.vat_rate_pct) : '21',
  );
  const [stripeOn, setStripeOn] = useState(initialMethods ? initialMethods.includes('stripe') : true);
  const [invoiceOn, setInvoiceOn] = useState(initialMethods ? initialMethods.includes('invoice') : false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const acct = account.trim();
    if (acct && !acct.startsWith('acct_')) {
      setError(t(locale, 'err_acct_prefix'));
      return;
    }
    if (showMethods && !stripeOn && !invoiceOn) {
      setError(t(locale, 'err_keep_one_method'));
      return;
    }
    const details: InvoiceDetails = {};
    if (legalName.trim()) details.legal_name = legalName.trim();
    if (address.trim()) details.address = address.trim();
    if (taxNo.trim()) details.tax_no = taxNo.trim();
    const rate = Number(vatRate.replace(',', '.'));
    if (vatOn && (!Number.isFinite(rate) || rate <= 0 || rate > 100)) {
      setError(t(locale, 'err_vat_rate'));
      return;
    }
    details.vat_registered = vatOn;
    details.vat_rate_pct = vatOn ? rate : null;
    const methods: ('stripe' | 'invoice')[] = [
      ...(stripeOn ? (['stripe'] as const) : []),
      ...(invoiceOn ? (['invoice'] as const) : []),
    ];
    startTransition(async () => {
      const r = await save(
        acct || null,
        Object.keys(details).length ? details : null,
        showMethods ? methods : null,
      );
      if (!r.ok) return setError(r.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex items-center gap-2">
        <SectionLabel>{label}</SectionLabel>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full ring-1 ${
            initialAccount
              ? 'ring-emerald-200 bg-emerald-50 text-emerald-700'
              : 'ring-line bg-surface-sunken text-ink-muted'
          }`}
        >
          {initialAccount ? t(locale, 'connected') : t(locale, 'not_connected')}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-ink-subtle max-w-xl leading-relaxed">{description}</p>
      {disabled ? (
        <p className="mt-2 text-xs text-ink-muted">{disabledNote}</p>
      ) : (
        <div className="mt-3 space-y-4">
          <label className="block">
            <span className="text-xs text-ink-subtle">{t(locale, 'stripe_account_id')}</span>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="acct_…"
              className={`${INPUT} font-mono`}
              autoComplete="off"
              spellCheck={false}
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <label className="block">
              <span className="text-xs text-ink-subtle">{t(locale, 'legal_name_on_invoices')}</span>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Solidarity Lab B.V."
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="text-xs text-ink-subtle">{t(locale, 'tax_vat_number')}</span>
              <input
                value={taxNo}
                onChange={(e) => setTaxNo(e.target.value)}
                placeholder="NL123456789B01"
                className={INPUT}
              />
            </label>
          </div>
          <label className="block max-w-2xl">
            <span className="text-xs text-ink-subtle">{t(locale, 'address_on_invoices')}</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className={`${INPUT} max-w-none`}
            />
          </label>

          <div>
            <span className="text-xs text-ink-subtle">{t(locale, 'vat_on_sales')}</span>
            <div className="mt-1.5 flex flex-wrap items-center gap-5">
              <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
                <input type="checkbox" checked={vatOn} onChange={(e) => setVatOn(e.target.checked)} />
                {t(locale, 'vat_registered_label')}
              </label>
              {vatOn && (
                <label className="inline-flex items-center gap-2 text-sm text-ink-subtle">
                  {t(locale, 'rate')}
                  <input
                    value={vatRate}
                    onChange={(e) => setVatRate(e.target.value)}
                    inputMode="decimal"
                    className="w-16 rounded-md border border-line bg-surface-raised px-2 py-1 text-sm text-right focus:border-line-strong focus:outline-none"
                  />
                  %
                </label>
              )}
            </div>
            <p className="mt-1 text-[11px] text-ink-muted max-w-xl">
              {t(locale, 'vat_included_note')}
            </p>
          </div>

          {showMethods && (
            <div>
              <span className="text-xs text-ink-subtle">
                {t(locale, 'default_payment_options')} —{' '}
                {methodsHint ?? t(locale, 'methods_hint_personal')}
              </span>
              <div className="mt-1.5 flex items-center gap-5">
                <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
                  <input
                    type="checkbox"
                    checked={stripeOn}
                    onChange={(e) => setStripeOn(e.target.checked)}
                  />
                  {t(locale, 'pay_online_card')}
                </label>
                <label className="inline-flex items-center gap-2 text-sm text-ink-subtle cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invoiceOn}
                    onChange={(e) => setInvoiceOn(e.target.checked)}
                  />
                  {t(locale, 'pay_per_invoice')}
                </label>
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t(locale, 'saving') : t(locale, 'save')}
            </Button>
            {saved && <span className="text-xs text-ink-subtle">{t(locale, 'saved')}</span>}
          </div>
        </div>
      )}
    </form>
  );
}
