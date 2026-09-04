'use client';

// Website embeds — copy-paste iframe snippets (the Thread-style generator,
// trimmed to Membership's two embeds). Each snippet carries its own
// height-listening <script> so the frame sizes itself to the content.

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { SectionLabel } from './page-chrome';

function heightScript(frameId: string): string {
  return `<script>
  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'membership-embed:height') {
      var f = document.getElementById('${frameId}');
      if (f) f.style.height = e.data.height + 'px';
    }
  });
</script>`;
}

export function EmbedsCard({ host, workspaceSlug }: { host: string; workspaceSlug: string }) {
  const [copied, setCopied] = useState<'tiers' | 'button' | null>(null);

  const tiersSnippet = `<iframe id="membership-tiers"
  src="${host}/embed/tiers?workspace=${encodeURIComponent(workspaceSlug)}"
  style="width:100%;border:0;display:block" title="Membership tiers"></iframe>
${heightScript('membership-tiers')}`;

  const buttonSnippet = `<iframe id="membership-join"
  src="${host}/embed/button?workspace=${encodeURIComponent(workspaceSlug)}&label=Become%20a%20member"
  style="width:100%;border:0;display:block" title="Join button"></iframe>
${heightScript('membership-join')}`;

  async function copy(which: 'tiers' | 'button', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard unavailable (permissions) — the user can select manually.
    }
  }

  return (
    <section className="rounded-lg border border-line bg-surface-raised p-5">
      <SectionLabel>Website embeds</SectionLabel>
      <p className="mt-1.5 text-xs text-ink-subtle leading-relaxed">
        Show your tiers and take memberships on any website — auto-sizing, copy-paste. Every
        element inside the embed carries a stable <code className="font-mono">me-*</code> class
        (me-card, me-title, me-price, me-btn, …) so you can restyle it.
      </p>

      <div className="mt-4 space-y-5">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-subtle">Tier cards — the full grid</span>
            <CopyButton copied={copied === 'tiers'} onClick={() => void copy('tiers', tiersSnippet)} />
          </div>
          <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
            {tiersSnippet}
          </pre>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-subtle">
              Join button — change the label via the URL&apos;s label parameter
            </span>
            <CopyButton
              copied={copied === 'button'}
              onClick={() => void copy('button', buttonSnippet)}
            />
          </div>
          <pre className="mt-1 rounded-lg border border-line bg-surface p-3 text-xs overflow-x-auto font-mono leading-relaxed">
            {buttonSnippet}
          </pre>
        </div>
      </div>
    </section>
  );
}

function CopyButton({ copied, onClick }: { copied: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken"
    >
      {copied ? (
        <>
          <Check size={12} strokeWidth={2} className="text-emerald-600" />
          Copied
        </>
      ) : (
        <>
          <Copy size={12} strokeWidth={1.75} />
          Copy
        </>
      )}
    </button>
  );
}
