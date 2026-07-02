'use client';

// "View & enrol" on an embedded listing card. Outside an embed.js iframe it
// opens the public thread page in a new tab. Inside one (?popup=1), it asks
// the parent page to open the enrol popup instead — embed.js listens for
// `thread-embed:open` and converts the public URL to an embed URL.
export function ViewButton({ url, popup }: { url: string; popup: boolean }) {
  const cls =
    'shrink-0 self-center h-8 rounded-md bg-ink text-ink-inverse px-3 text-xs font-medium hover:opacity-90 inline-flex items-center';

  if (!popup) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={cls}>
        View &amp; enrol
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={() => window.parent.postMessage({ type: 'thread-embed:open', url }, '*')}
    >
      View &amp; enrol
    </button>
  );
}
