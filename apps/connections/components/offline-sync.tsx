'use client';

// Keeps the device ready for a lost connection, from every page.
//
// Mounted once in the signed-in layout. Two jobs, both quiet:
//
//   1. Record which workspace is active, so a note queued offline is stamped
//      with the workspace it belongs to (see lib/offline-notes.ts for why that
//      stopped being optional).
//   2. Send waiting notes — on arrival and every time the connection returns.
//      This used to live inside the note composer, which meant a note queued
//      in a lift was only sent if somebody later opened a note box. It belongs
//      to the app, not to one form.
//
// It used to have a third: keeping a list of people on the phone for the
// offline page. Removed 2026-09-13 (Sjoerd) — see forgetLegacyPeople. It now
// deletes that list from any device that still carries one.
//
// It also registers the service worker, for the same reason: it is the one
// client component every signed-in page renders.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveNote } from '@/app/(app)/people/[id]/actions';
import {
  QUEUE_CHANGED,
  flushQueuedNotes,
  forgetLegacyPeople,
  queuedNotes,
  setCurrentWorkspace,
} from '@/lib/offline-notes';

export function OfflineSync({ workspaceId }: { workspaceId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    // First, before anything can return early: a device that ran v0.73.18
    // holds a list of names, and it should not outlive the decision to stop
    // keeping one.
    forgetLegacyPeople();
    if (!workspaceId) return;
    setCurrentWorkspace(workspaceId);

    let alive = true;
    let running = false;

    const flush = async () => {
      if (running) return;
      const before = queuedNotes(workspaceId).length;
      if (!before) return;
      running = true;
      try {
        const stuck = await flushQueuedNotes((p) => saveNote(p as never), workspaceId);
        if (!alive) return;
        // Announce ONLY when something left the queue. This listens to the
        // same event, so announcing unconditionally loops forever while a
        // note waits for a person: flush, announce, flush, announce.
        if (stuck < before) {
          window.dispatchEvent(new Event(QUEUE_CHANGED));
          router.refresh();
        }
      } finally {
        running = false;
      }
    };

    void flush();
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    // A note just filed by UnfiledNotes is sendable now; the queue event is
    // how that component says so without importing this one.
    window.addEventListener(QUEUE_CHANGED, onOnline);

    // The service worker. Registered here and nowhere else. A failure is
    // logged and otherwise ignored: without it the app works exactly as it
    // did, just not with the signal gone.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => {
        console.warn('[offline] service worker registration failed', e);
      });
    }

    return () => {
      alive = false;
      window.removeEventListener('online', onOnline);
      window.removeEventListener(QUEUE_CHANGED, onOnline);
    };
  }, [workspaceId, router]);

  return null;
}
