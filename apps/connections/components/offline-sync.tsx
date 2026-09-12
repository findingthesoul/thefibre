'use client';

// Keeps the device ready for a lost connection, from every page.
//
// Mounted once in the signed-in layout. Three jobs, all quiet:
//
//   1. Record which workspace is active, so a note queued offline is stamped
//      with the workspace it belongs to (see lib/offline-notes.ts for why that
//      stopped being optional).
//   2. Send waiting notes — on arrival and every time the connection returns.
//      This used to live inside the note composer, which meant a note queued
//      in a lift was only sent if somebody later opened a note box. It belongs
//      to the app, not to one form.
//   3. Keep a list of people for the offline page, refreshed while online, so
//      that when there is no signal at all there is still somebody to pick.
//
// It also registers the service worker, for the same reason: it is the one
// client component every signed-in page renders.

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { saveNote, fetchVocabulary } from '@/app/(app)/people/[id]/actions';
import {
  QUEUE_CHANGED,
  cachePeople,
  flushQueuedNotes,
  queuedNotes,
  setCurrentWorkspace,
} from '@/lib/offline-notes';

export function OfflineSync({ workspaceId }: { workspaceId: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!workspaceId) return;
    setCurrentWorkspace(workspaceId);

    let alive = true;

    const flush = async () => {
      const before = queuedNotes(workspaceId).length;
      if (!before) return;
      const stuck = await flushQueuedNotes((p) => saveNote(p as never), workspaceId);
      if (!alive) return;
      window.dispatchEvent(new Event(QUEUE_CHANGED));
      // Something landed, so any list of notes on screen is out of date.
      if (stuck < before) router.refresh();
    };

    const refreshPeople = async () => {
      if (!navigator.onLine) return;
      const v = await fetchVocabulary();
      if (alive && v.people.length) cachePeople(workspaceId, v.people);
    };

    void flush();
    void refreshPeople();

    const onOnline = () => {
      void flush();
      void refreshPeople();
    };
    window.addEventListener('online', onOnline);

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
    };
  }, [workspaceId, router]);

  return null;
}
