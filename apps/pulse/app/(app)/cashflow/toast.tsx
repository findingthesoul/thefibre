'use client';

// Error toasts (Sjoerd 2026-07-09: "warnings are popups... not at the bottom
// of a popup with scroll"). A module-level store + one <ToastStack /> mount
// (pipeline-view renders it): any code in the lane calls toastError(msg) and
// a red toast pops top-right, above every dialog (dialogs are z-50), auto-
// dismisses after 6s, or dismisses on click. Field-level VALIDATION messages
// stay inline near their field — this is for server/API failures.

import { useEffect, useState } from 'react';

type Toast = { id: number; message: string };

let seq = 0;
let toasts: Toast[] = [];
const listeners = new Set<(next: Toast[]) => void>();

function emit() {
  for (const l of listeners) l(toasts);
}

export function toastError(message: string) {
  const id = ++seq;
  toasts = [...toasts, { id, message }];
  emit();
  setTimeout(() => dismissToast(id), 6000);
}

function dismissToast(id: number) {
  if (!toasts.some((t) => t.id === id)) return;
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function ToastStack() {
  const [list, setList] = useState<Toast[]>([]);
  useEffect(() => {
    listeners.add(setList);
    setList(toasts); // catch anything fired before mount
    return () => {
      listeners.delete(setList);
    };
  }, []);
  if (list.length === 0) return null;
  return (
    <div
      aria-live="assertive"
      className="fixed right-4 top-4 z-[70] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
    >
      {list.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          title="Dismiss"
          className="rounded-lg bg-red-600 px-4 py-2.5 text-left text-sm text-white shadow-lg"
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
