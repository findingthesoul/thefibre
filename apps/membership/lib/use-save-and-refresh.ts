'use client';

// After a save: refresh the page's data, and only THEN close the dialog
// (Sjoerd, 2026-10-17: "very often I have to click twice or three times, or
// I don't see what is happening"). Measured on staging: a tier Save closed
// its dialog at 0.8 s and the list showed the new values at 1.7 s — almost a
// second of the OLD state on screen, which reads as "it didn't take".
//
// router.refresh() runs inside a transition, so `refreshing` stays true until
// the new server render is on screen; `after` (usually onClose) runs then.
// A failed save never calls this: the dialog stays open with its error and
// the fields keep what was typed.

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function useSaveAndRefresh() {
  const router = useRouter();
  const [refreshing, startTransition] = useTransition();
  // Bumped per call, so the effect below also runs when the transition
  // settled within the same render (nothing to wait for).
  const [tick, setTick] = useState(0);
  const after = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (refreshing || !after.current) return;
    const run = after.current;
    after.current = null;
    run();
  }, [refreshing, tick]);

  const refreshThen = useCallback(
    (then?: () => void) => {
      after.current = then ?? null;
      setTick((n) => n + 1);
      startTransition(() => router.refresh());
    },
    [router],
  );

  return { refreshing, refreshThen };
}
