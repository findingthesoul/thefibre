'use client';

// Two levels, two small forms — the Stripe Connect account (Meet's
// paste-flow) AND the invoice issuer identity (legal name, address,
// tax/VAT no.) that receipts and invoices show as the seller.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  updateMyPayments,
  updateWorkspacePayments,
  type InvoiceDetails,
} from './actions';
import { SectionLabel } from '@/components/ui/page';
import { Button } from '@/components/ui/button';

const INPUT =
  'mt-1 w-full max-w-md rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:border-line-strong focus:outline-none placeholder:text-ink-muted';

export function PaymentsForm({
  personalAccount,
  personalDetails,
  workspaceAccount,
  workspaceDetails,
  isAdmin,
}: {
  personalAccount: string | null;
  personalDetails: InvoiceDetails | null;
  workspaceAccount: string | null;
  workspaceDetails: InvoiceDetails | null;
  isAdmin: boolean;
}) {
  return (
    <div className="mt-8 space-y-10">
      <AccountSection
        label="My account"
        description="Payouts for your personal threads and meeting types. Shared with Fibre Meet — connect once, both apps use it. The invoice details appear as the seller on receipts for your personal sales."
        initialAccount={personalAccount}
        initialDetails={personalDetails}
        save={updateMyPayments}
      />
      <AccountSection
        label="Workspace account"
        description="Payouts for team threads and anything routed to the workspace. Teams don't hold their own accounts — team sales land here, with these invoice details as the seller."
        initialAccount={workspaceAccount}
        initialDetails={workspaceDetails}
        save={updateWorkspacePayments}
        disabled={!isAdmin}
        disabledNote="Managed by workspace admins."
      />
      <p className="text-xs text-ink-muted max-w-xl leading-relaxed">
        The Stripe account id starts with <code className="font-mono">acct_</code> (Stripe →
        Settings → Account details). Leaving it empty disconnects that account.
      </p>
    </div>
  );
}

function AccountSection({
  label,
  description,
  initialAccount,
  initialDetails,
  save,
  disabled = false,
  disabledNote,
}: {
  label: string;
  description: string;
  initialAccount: string | null;
  initialDetails: InvoiceDetails | null;
  save: (
    accountId: string | null,
    details: InvoiceDetails | null,
  ) => Promise<{ ok: true } | { ok: false; error: string }>;
  disabled?: boolean;
  disabledNote?: string;
}) {
  const router = useRouter();
  const [account, setAccount] = useState(initialAccount ?? '');
  const [legalName, setLegalName] = useState(initialDetails?.legal_name ?? '');
  const [address, setAddress] = useState(initialDetails?.address ?? '');
  const [taxNo, setTaxNo] = useState(initialDetails?.tax_no ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const acct = account.trim();
    if (acct && !acct.startsWith('acct_')) {
      setError('A Stripe account id starts with acct_');
      return;
    }
    const details: InvoiceDetails = {};
    if (legalName.trim()) details.legal_name = legalName.trim();
    if (address.trim()) details.address = address.trim();
    if (taxNo.trim()) details.tax_no = taxNo.trim();
    startTransition(async () => {
      const r = await save(acct || null, Object.keys(details).length ? details : null);
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
          {initialAccount ? 'Connected' : 'Not connected'}
        </span>
      </div>
      <p className="mt-1.5 text-xs text-ink-subtle max-w-xl leading-relaxed">{description}</p>
      {disabled ? (
        <p className="mt-2 text-xs text-ink-muted">{disabledNote}</p>
      ) : (
        <div className="mt-3 space-y-4">
          <label className="block">
            <span className="text-xs text-ink-subtle">Stripe account id</span>
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
              <span className="text-xs text-ink-subtle">Legal name (on invoices)</span>
              <input
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                placeholder="Solidarity Lab B.V."
                className={INPUT}
              />
            </label>
            <label className="block">
              <span className="text-xs text-ink-subtle">Tax / VAT number</span>
              <input
                value={taxNo}
                onChange={(e) => setTaxNo(e.target.value)}
                placeholder="NL123456789B01"
                className={INPUT}
              />
            </label>
          </div>
          <label className="block max-w-2xl">
            <span className="text-xs text-ink-subtle">Address (on invoices)</span>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              rows={2}
              className={`${INPUT} max-w-none`}
            />
          </label>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? 'Saving…' : 'Save'}
            </Button>
            {saved && <span className="text-xs text-ink-subtle">Saved.</span>}
          </div>
        </div>
      )}
    </form>
  );
}
