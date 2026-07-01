'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import type { CertScope } from '@/lib/certificate-types';
import { createCertificateTemplate } from './actions';

export function NewTemplateDialog({ teams }: { teams: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<CertScope>('personal');
  const [teamId, setTeamId] = useState(teams[0]?.id ?? '');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCreate = name.trim().length > 0 && (scope !== 'team' || !!teamId);

  async function create() {
    if (!canCreate || pending) return;
    setPending(true);
    setError(null);
    const result = await createCertificateTemplate({
      name: name.trim(),
      scope,
      owner_team_id: scope === 'team' ? teamId : null,
    });
    if (result.ok && result.id) {
      router.push(`/certificates/${result.id}`);
      return; // keep pending state while navigating
    }
    setPending(false);
    setError(result.ok ? 'Template was created without an id.' : result.error);
  }

  const scopeOptions = [
    { value: 'personal', label: 'Personal — only you' },
    ...(teams.length > 0 ? [{ value: 'team', label: 'Team' }] : []),
    { value: 'workspace', label: 'Workspace — share with specific people' },
  ];

  return (
    <>
      <Button leading={<Plus size={16} strokeWidth={1.75} />} onClick={() => setOpen(true)}>
        New template
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title="New certificate template"
        description="Name it and choose who can use it. You design it next."
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!canCreate || pending}>
              {pending ? 'Creating…' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label="Name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Completion certificate"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
            }}
          />
          <SelectField
            label="Scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as CertScope)}
            options={scopeOptions}
          />
          {scope === 'team' && (
            <SelectField
              label="Team"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              options={teams.map((t) => ({ value: t.id, label: t.name }))}
            />
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
