'use client';

// Share picker for workspace-scoped templates: tick the people and teams
// that may use this template. PUT replaces the whole list server-side.

import { useEffect, useState } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';
import type { TeamOption, WorkspaceMember } from '@/lib/thread-types';
import type { CertShares } from '@/lib/certificate-types';
import { saveCertificateShares } from '../actions';

function CheckRow({
  label,
  sub,
  checked,
  onToggle,
}: {
  label: string;
  sub?: string | null;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-surface-sunken cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="h-4 w-4 rounded border-line accent-ink"
      />
      <span className="min-w-0">
        <span className="block text-sm text-ink truncate">{label}</span>
        {sub && <span className="block text-xs text-ink-muted truncate">{sub}</span>}
      </span>
    </label>
  );
}

export function ShareDialog({
  open,
  onClose,
  templateId,
  members,
  teams,
  shares,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  templateId: string;
  members: WorkspaceMember[];
  teams: TeamOption[];
  shares: CertShares;
  onSaved: (next: CertShares) => void;
}) {
  const [userIds, setUserIds] = useState<Set<string>>(new Set(shares.user_ids));
  const [teamIds, setTeamIds] = useState<Set<string>>(new Set(shares.team_ids));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed from the last saved state each time the dialog opens.
  useEffect(() => {
    if (open) {
      setUserIds(new Set(shares.user_ids));
      setTeamIds(new Set(shares.team_ids));
      setError(null);
    }
  }, [open, shares]);

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  async function save() {
    setPending(true);
    setError(null);
    const next: CertShares = { user_ids: [...userIds], team_ids: [...teamIds] };
    const result = await saveCertificateShares(templateId, next);
    setPending(false);
    if (result.ok) {
      onSaved(next);
      onClose();
    } else {
      setError(result.error);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Share template"
      description="Who in the workspace can use this template on their threads."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending}>
            {pending ? 'Saving…' : 'Save shares'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {teams.length > 0 && (
          <div>
            <SectionLabel>Teams</SectionLabel>
            <div className="mt-2 space-y-0.5">
              {teams.map((t) => (
                <CheckRow
                  key={t.id}
                  label={t.name}
                  checked={teamIds.has(t.id)}
                  onToggle={() => setTeamIds((prev) => toggle(prev, t.id))}
                />
              ))}
            </div>
          </div>
        )}

        <div>
          <SectionLabel>People</SectionLabel>
          {members.length === 0 ? (
            <p className="mt-2 text-sm text-ink-subtle">No other workspace members.</p>
          ) : (
            <div className="mt-2 space-y-0.5">
              {members.map((m) => (
                <CheckRow
                  key={m.user_id}
                  label={m.full_name ?? m.email ?? m.user_id}
                  sub={m.full_name ? m.email : null}
                  checked={userIds.has(m.user_id)}
                  onToggle={() => setUserIds((prev) => toggle(prev, m.user_id))}
                />
              ))}
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>
    </Dialog>
  );
}
