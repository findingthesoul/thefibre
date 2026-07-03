'use client';

// "View & enrol" on an embedded listing card. Threads with popup interaction
// (and running inside an embed.js iframe, ?popup=1) ask the parent page to
// open the Luma-style enrol overlay — embed.js listens for
// `thread-embed:open-enrol` and mounts the popup with the given lang.
// Page-interaction threads (or standalone rendering) link out to the public
// thread page instead.
export function ViewButton({
  url,
  popup,
  organiser,
  thread,
  lang,
  label,
}: {
  url: string;
  popup: boolean;
  organiser: string;
  thread: string;
  lang: string;
  label: string;
}) {
  const cls =
    'shrink-0 self-center h-8 rounded-md bg-ink text-ink-inverse px-3 text-xs font-medium hover:opacity-90 inline-flex items-center';

  if (!popup) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className={cls}>
        {label}
      </a>
    );
  }

  return (
    <button
      type="button"
      className={cls}
      onClick={() =>
        window.parent.postMessage({ type: 'thread-embed:open-enrol', organiser, thread, lang }, '*')
      }
    >
      {label}
    </button>
  );
}
