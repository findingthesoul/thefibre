'use client';

// "This app can live on your home screen" — a small bar on a PHONE, for a
// browser that can install the app and has not yet (Sjoerd, 2026-10-16: "In
// the app, on mobile, there should be some sort of a message that you can
// download the app as a webapp").
//
// Born here rather than in one app, because more than one app in the family
// is installable (my.thread first; Connect, Meet and the platform carry
// manifests too). The words are the APP's: they arrive as `labels`, from the
// app's own catalog, so this file holds no language and no copy.
//
// ── When it shows, and when it does not ──────────────────────────────────
//
//   * Only after hydration (an effect), never on first paint: the server
//     cannot know the browser, and a bar that flashes and vanishes is worse
//     than none.
//   * Only on a phone-sized screen. Desktop installs are a menu item away and
//     nobody asked for a bar there.
//   * Never when the app is ALREADY installed: `display-mode: standalone`,
//     or `navigator.standalone` on iOS.
//   * Android / Chrome: only once the browser has fired `beforeinstallprompt`
//     — its own judgement that the app is installable. "Install" then opens
//     the browser's real dialog.
//   * iPhone Safari: there is no prompt API, so the bar shows the two steps
//     instead (Share → Add to Home Screen). Other iPhone browsers (Chrome,
//     Firefox, Edge) are skipped: their Share sheets differ, and telling
//     someone to find a button that is not there is worse than silence.
//   * Any other browser that cannot install: nothing.
//   * "Not now" is remembered on this device for `snoozeDays` (30), in
//     localStorage. Every read and write is guarded: a private window or
//     blocked storage just means the bar may come back, never a crash.
//
// It renders IN THE FLOW (no `fixed`): the caller puts it above the bottom
// nav, so it can never cover the nav or the page's last row.

import { useEffect, useState, type ReactNode } from 'react';
import { Share, X } from 'lucide-react';
import { Button } from './button.js';

/** Chrome's event: the browser's own install dialog, held until asked. */
type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export type InstallPromptLabels = {
  /** "Install my.thread on your phone" */
  title: string;
  /** The button that opens the browser's dialog (Android/Chrome). */
  install: string;
  /** Dismiss for `snoozeDays`. */
  notNow: string;
  /** iPhone: the steps, with `{share}` where the Share icon goes. */
  iosSteps: string;
  /** The link to the app's help guide on installing. */
  help: string;
  /** Accessible name of the close (X) button. */
  close: string;
};

type Mode = 'android' | 'ios' | null;

const DAY = 24 * 60 * 60 * 1000;

function snoozedUntil(key: string): number {
  try {
    return Number(window.localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function snooze(key: string, days: number): void {
  try {
    window.localStorage.setItem(key, String(Date.now() + days * DAY));
  } catch {
    // Storage blocked: the bar may come back next visit. That is all.
  }
}

/** Installed already — the app is running in its own window. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** iPhone (or iPod) Safari itself, not another browser's shell around it. */
export function isIosSafari(ua: string): boolean {
  return /iP(hone|od)/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(ua);
}

export function InstallPrompt({
  labels,
  helpHref,
  storageKey,
  snoozeDays = 30,
  /** The app's name in the iOS steps' {app}, if the labels use it. */
  children,
}: {
  labels: InstallPromptLabels;
  helpHref: string;
  /** One per app, e.g. 'my.install.snoozed-until'. */
  storageKey: string;
  snoozeDays?: number;
  children?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [event, setEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (isStandalone()) return;
    if (!window.matchMedia?.('(max-width: 767px)').matches) return;
    if (snoozedUntil(storageKey) > Date.now()) return;

    if (isIosSafari(navigator.userAgent)) {
      setMode('ios');
      return;
    }
    const onPrompt = (e: Event) => {
      // Hold the browser's own mini-infobar back; ours says it in the app's words.
      e.preventDefault();
      setEvent(e as InstallEvent);
      setMode('android');
    };
    const onInstalled = () => setMode(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [storageKey]);

  if (!mode) return null;

  function dismiss() {
    snooze(storageKey, snoozeDays);
    setMode(null);
  }

  async function install() {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    // Accepted: the app is installing, the bar has done its job. Dismissed in
    // the browser's own dialog: that is a "not now" too.
    if (outcome === 'dismissed') snooze(storageKey, snoozeDays);
    setEvent(null);
    setMode(null);
  }

  const [before, after] = labels.iosSteps.split('{share}');

  return (
    <div
      role="region"
      aria-label={labels.title}
      data-install-prompt={mode}
      className="md:hidden shrink-0 border-t border-line bg-surface-raised px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink">{labels.title}</p>
          {mode === 'ios' && (
            <p className="mt-0.5 text-xs text-ink-subtle">
              {before}
              <Share className="mx-0.5 inline h-3.5 w-3.5 -translate-y-px" aria-hidden />
              {after ?? ''}
            </p>
          )}
          {children}
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={labels.close}
          className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted hover:text-ink"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      {/* One row: the action (Android only — iPhone has no button that can
          install), Not now, and the help guide on the right. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {mode === 'android' && (
          <Button type="button" size="sm" onClick={() => void install()}>
            {labels.install}
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" onClick={dismiss}>
          {labels.notNow}
        </Button>
        <a
          href={helpHref}
          className="ml-auto inline-flex min-h-11 items-center text-xs text-ink-muted underline underline-offset-2"
        >
          {labels.help}
        </a>
      </div>
    </div>
  );
}
