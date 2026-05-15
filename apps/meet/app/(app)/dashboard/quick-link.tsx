'use client';

import { useState } from 'react';

export type QuickLink = {
  id: string;
  name: string;
  team: string | null;
  durationMinutes: number;
  path: string;
  url: string;
};

export function QuickLinkRow({ link }: { link: QuickLink }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    if (!link.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // no-op
    }
  }
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span>{link.name}</span>
          {link.team && (
            <span className="text-[10px] uppercase tracking-wider text-ink-muted border border-line rounded px-1.5 py-0.5">
              {link.team}
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-ink-muted truncate">
          {link.durationMinutes} min · {link.path}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="text-ink-subtle hover:text-ink p-1"
          aria-label="Copy link"
          title={copied ? 'Copied!' : 'Copy link'}
        >
          {copied ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
        <a
          href={link.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
        >
          Open <span aria-hidden="true">↗</span>
        </a>
      </div>
    </div>
  );
}
