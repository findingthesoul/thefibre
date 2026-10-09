'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { TextField, TextAreaField } from '@/components/ui/field';
import { SectionLabel, EmptyState } from '@/components/ui/page';
import { ListGroup, ListRow } from '@/components/ui/list';
import { t, type Locale } from '@/lib/i18n-ui';
import { createTeam } from './actions';

export type GrantableApp = { id: string; slug: string; name: string };

export type TeamRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
  member_count: number;
  apps: { slug: string; name: string; lead_is_app_admin: boolean }[];
  /** 'admins' | 'everyone' for the two maintained teams, null for a team
   *  somebody made. Optional: an API that predates it simply sends none, and
   *  then every team reads as a custom one, which is what this page did
   *  before. */
  automatic?: string | null;
};

export function TeamsClient({
  teams,
  grantable,
  canEditGrants,
  locale,
}: {
  teams: TeamRow[];
  grantable: GrantableApp[];
  canEditGrants: boolean;
  locale: Locale;
}) {
  const [creating, setCreating] = useState(false);

  // Separated rather than mixed into one list: these two are not teams
  // somebody made, they cannot be renamed or emptied, and the apps they carry
  // answer a different question — what a NEWCOMER gets, rather than what one
  // group may open.
  const isAutomatic = (t: TeamRow) => t.automatic === 'admins' || t.automatic === 'everyone';
  const automatic = teams.filter(isAutomatic);
  const custom = teams.filter((t) => !isAutomatic(t));

  return (
    <>
      <section className="mt-10">
        <div className="flex items-center justify-between gap-4">
          <SectionLabel>{t(locale, 'teams_title')}</SectionLabel>
          <Button
            leading={<UsersRound size={16} strokeWidth={1.75} />}
            onClick={() => setCreating(true)}
          >
            {t(locale, 'new_team')}
          </Button>
        </div>

        {custom.length === 0 ? (
          <EmptyState>{t(locale, 'no_teams_yet')}</EmptyState>
        ) : (
          <ListGroup>
            {custom.map((team) => (
              <ListRow
                key={team.id}
                href={`/settings/teams/${team.id}`}
                primary={team.name}
                secondary={summarise(team, locale)}
              />
            ))}
          </ListGroup>
        )}

        {/* About CUSTOM teams only. The two below are editable on every plan,
            so showing this under them would say the opposite of what is
            true. */}
        {!canEditGrants && grantable.length > 0 && (
          <p className="mt-4 text-sm text-ink-muted">{t(locale, 'team_grants_need_pro')}</p>
        )}
      </section>

      {automatic.length > 0 && (
        <section className="mt-10">
          <SectionLabel>{t(locale, 'teams_automatic_title')}</SectionLabel>
          <p className="mt-2 text-sm text-ink-muted">{t(locale, 'teams_automatic_blurb')}</p>
          <ListGroup>
            {automatic.map((team) => (
              <ListRow
                key={team.id}
                href={`/settings/teams/${team.id}`}
                primary={team.name}
                secondary={summarise(team, locale)}
              />
            ))}
          </ListGroup>
        </section>
      )}

      {creating && <CreateTeamDialog locale={locale} onClose={() => setCreating(false)} />}
    </>
  );
}

// "4 people · Pulse, Membership · Internal" — what the team is and what it
// opens, without needing the detail page.
function summarise(team: TeamRow, locale: Locale): string {
  const bits: string[] = [`${team.member_count} ${t(locale, 'team_members_label').toLowerCase()}`];
  if (team.apps.length) bits.push(team.apps.map((a) => a.name).join(', '));
  if (!team.is_published) bits.push(t(locale, 'team_internal'));
  if (!team.is_active) bits.push(t(locale, 'team_retired'));
  return bits.join(' · ');
}

function CreateTeamDialog({ locale, onClose }: { locale: Locale; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // Default to internal: most teams made from this screen exist to group
  // people, not to be published. A public page is the deliberate choice.
  const [published, setPublished] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createTeam({
        name,
        description: description || null,
        is_published: published,
      });
      if (r.error) {
        setError(r.error);
        return;
      }
      onClose();
      if (r.id) router.push(`/settings/teams/${r.id}`);
      else router.refresh();
    });
  }

  return (
    <Dialog
      open
      onClose={() => !pending && onClose()}
      title={t(locale, 'new_team')}
      description={t(locale, 'teams_blurb')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={pending}>
            {t(locale, 'cancel')}
          </Button>
          <Button type="submit" form="new-team-form" disabled={pending || !name.trim()}>
            {pending ? t(locale, 'saving') : t(locale, 'new_team')}
          </Button>
        </>
      }
    >
      <form id="new-team-form" onSubmit={onSubmit} className="space-y-4">
        <TextField
          label={t(locale, 'team_name')}
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <TextAreaField
          label={t(locale, 'team_description')}
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 rounded border-line"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          <span>
            {t(locale, 'team_published')}
            <span className="block text-xs text-ink-muted">
              {t(locale, 'team_published_help')}
            </span>
          </span>
        </label>

        {error && (
          <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </form>
    </Dialog>
  );
}
