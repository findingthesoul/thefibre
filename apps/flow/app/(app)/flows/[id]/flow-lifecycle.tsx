'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MoreHorizontal, Lock, Archive, Play, Trash2 } from 'lucide-react';
import { patchFlow, deleteFlow } from '../actions';
import { ConfirmDialog } from '@/components/ui/dialog';

type Lifecycle = 'draft' | 'active' | 'closed' | 'archived';

type PendingConfirm = {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  run: () => Promise<void>;
};

export function FlowLifecycleMenu({
  flowId,
  lifecycle,
  activeRunCount,
}: {
  flowId: string;
  lifecycle: Lifecycle;
  activeRunCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setLifecycle(next: Lifecycle) {
    setBusy(true);
    setError(null);
    const res = await patchFlow(flowId, { lifecycle: next });
    setBusy(false);
    setOpen(false);
    if (!res.error) router.refresh();
    else setError(res.error);
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await deleteFlow(flowId);
    setBusy(false);
    if (!res.error) router.push('/flows');
    else setError(res.error);
  }

  const closeMsg =
    activeRunCount > 0
      ? `${activeRunCount} contact${activeRunCount === 1 ? '' : 's'} still active in this flow. Closing stops new contacts entering; existing ones can still be moved to completion.`
      : null;

  return (
    <div className="relative">
      <span className="inline-flex items-center gap-2">
        {error && <span className="text-xs text-red-700">{error}</span>}
        <button
          onClick={() => setOpen((o) => !o)}
          disabled={busy}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-line bg-white hover:border-line-strong text-ink-subtle"
          title="Flow actions"
        >
          <MoreHorizontal size={16} />
        </button>
      </span>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 w-52 rounded-lg border border-line bg-white shadow-lg py-1 z-20 text-sm">
            {lifecycle === 'active' && (
              <MenuItem
                icon={Lock}
                onClick={() => {
                  setOpen(false);
                  if (closeMsg) {
                    setConfirm({
                      title: 'Close to new contacts',
                      message: closeMsg,
                      confirmLabel: 'Close flow',
                      run: () => setLifecycle('closed'),
                    });
                  } else {
                    void setLifecycle('closed');
                  }
                }}
              >
                Close to new contacts
              </MenuItem>
            )}
            {lifecycle === 'closed' && (
              <MenuItem icon={Play} onClick={() => void setLifecycle('active')}>
                Reopen
              </MenuItem>
            )}
            {lifecycle !== 'archived' && lifecycle !== 'draft' && (
              <MenuItem
                icon={Archive}
                onClick={() => {
                  setOpen(false);
                  setConfirm({
                    title: 'Archive flow',
                    message: 'Archive this flow? It becomes read-only.',
                    confirmLabel: 'Archive',
                    run: () => setLifecycle('archived'),
                  });
                }}
              >
                Archive
              </MenuItem>
            )}
            {lifecycle === 'archived' && (
              <MenuItem icon={Play} onClick={() => void setLifecycle('active')}>
                Restore to active
              </MenuItem>
            )}
            <div className="my-1 border-t border-line" />
            <MenuItem
              icon={Trash2}
              danger
              onClick={() => {
                setOpen(false);
                setConfirm({
                  title: 'Delete flow',
                  message:
                    'Delete this flow? It will be hidden (soft delete). Active contacts keep their history.',
                  confirmLabel: 'Delete',
                  destructive: true,
                  run: remove,
                });
              }}
            >
              Delete flow
            </MenuItem>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!confirm}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c) void c.run();
        }}
        title={confirm?.title ?? ''}
        message={confirm?.message ?? ''}
        confirmLabel={confirm?.confirmLabel ?? 'Confirm'}
        destructive={confirm?.destructive}
        pending={busy}
      />
    </div>
  );
}

function MenuItem({
  icon: Icon,
  children,
  onClick,
  danger,
}: {
  icon: typeof Lock;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-surface-sunken ${
        danger ? 'text-red-600' : 'text-ink-subtle hover:text-ink'
      }`}
    >
      <Icon size={15} strokeWidth={1.75} />
      {children}
    </button>
  );
}
