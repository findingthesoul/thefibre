'use client';

// Settings → Assistant → "B. Your own Claude": the address to paste, with a
// copy button. Sjoerd, 2026-09-27: "when someone wants to connect to the
// fibre with their claude, they need the link too no?" — yes, and this is
// where it lives. The address itself comes from the server component
// (branding.ts mcpConnectorUrl: the stack the page is served from).

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';

export function ConnectorAddress({ locale, url }: { locale: Locale; url: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    void navigator.clipboard.writeText(url).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      // Refused clipboard (insecure origin, permission policy): the address
      // is on the screen and selectable, so saying nothing is the honest state.
      () => setCopied(false),
    );
  }

  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ink-muted">{t(locale, 'assistant_connector_address')}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 select-all overflow-x-auto rounded-md border border-line bg-surface-sunken px-3 py-2 text-sm text-ink">{url}</code>
        <Button type="button" variant="secondary" size="sm" onClick={copy}>
          {copied ? (
            <>
              <Check size={14} strokeWidth={1.75} />
              {t(locale, 'copied')}
            </>
          ) : (
            <>
              <Copy size={14} strokeWidth={1.75} />
              {t(locale, 'copy')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
