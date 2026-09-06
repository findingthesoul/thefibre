'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { TextField, SelectField } from '@/components/ui/field';
import type { CertScope } from '@/lib/certificate-types';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { createCertificateTemplate } from './actions';

export function NewTemplateDialog({
  locale,
  teams,
}: {
  locale: Locale;
  teams: { id: string; name: string }[];
}) {
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
    setError(result.ok ? t(locale, 'err_template_no_id') : result.error);
  }

  const scopeOptions = [
    { value: 'personal', label: t(locale, 'scope_personal_only_you') },
    ...(teams.length > 0 ? [{ value: 'team', label: t(locale, 'team') }] : []),
    { value: 'workspace', label: t(locale, 'scope_workspace_share') },
  ];

  return (
    <>
      <Button leading={<Plus size={16} strokeWidth={1.75} />} onClick={() => setOpen(true)}>
        {t(locale, 'new_template')}
      </Button>

      <Dialog
        open={open}
        onClose={() => {
          if (!pending) setOpen(false);
        }}
        title={t(locale, 'new_cert_template')}
        description={t(locale, 'new_cert_template_desc')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              {t(locale, 'cancel')}
            </Button>
            <Button onClick={create} disabled={!canCreate || pending}>
              {pending ? t(locale, 'creating') : t(locale, 'create')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField
            label={t(locale, 'name')}
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t(locale, 'cert_name_placeholder')}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') create();
            }}
          />
          <SelectField
            label={t(locale, 'scope')}
            value={scope}
            onChange={(e) => setScope(e.target.value as CertScope)}
            options={scopeOptions}
          />
          {scope === 'team' && (
            <SelectField
              label={t(locale, 'team')}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              options={teams.map((tm) => ({ value: tm.id, label: tm.name }))}
            />
          )}
          {error && <p className="text-sm text-red-700">{error}</p>}
        </div>
      </Dialog>
    </>
  );
}
