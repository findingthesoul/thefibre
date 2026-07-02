'use client';

import { useActionState, useMemo } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/button';
import { TextField, TextAreaField, SelectField } from '@/components/ui/field';
import { updateMe, updateProfile } from './actions';

type Me = { full_name: string | null; avatar_url: string | null };

export function ProfileForm({ me }: { me: Me }) {
  const [state, action] = useActionState(updateMe, {});

  return (
    <form action={action} className="mt-4 space-y-4 max-w-md">
      <TextField
        label="Full name"
        name="full_name"
        defaultValue={me.full_name ?? ''}
        required
        errors={state.fieldErrors?.full_name}
      />
      <TextField
        label="Avatar URL"
        name="avatar_url"
        defaultValue={me.avatar_url ?? ''}
        placeholder="https://…"
        errors={state.fieldErrors?.avatar_url}
      />

      {state.error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          {state.error}
        </div>
      )}

      {state.ok && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          Saved.
        </div>
      )}

      <Submit />
    </form>
  );
}

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Public profile — display name / bio / photo / timezone.
// Shared across the Fibre apps — Meet and Thread inherit these.
// ---------------------------------------------------------------------------

export type PublicProfile = {
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  timezone: string | null;
};

export function PublicProfileForm({ profile }: { profile: PublicProfile }) {
  const [state, action] = useActionState(updateProfile, {});

  const timezones = useMemo(() => {
    const intl = Intl as unknown as {
      supportedValuesOf?: (key: string) => string[];
    };
    return intl.supportedValuesOf?.('timeZone') ?? [];
  }, []);

  return (
    <form action={action} className="mt-4 space-y-4 max-w-md">
      <TextField
        label="Display name"
        name="display_name"
        defaultValue={profile.display_name ?? ''}
        placeholder="How the apps show your name"
        errors={state.fieldErrors?.display_name}
      />
      <TextAreaField
        label="Bio"
        name="bio"
        defaultValue={profile.bio ?? ''}
        placeholder="A short line about you"
        errors={state.fieldErrors?.bio}
      />
      <TextField
        label="Photo URL"
        name="photo_url"
        defaultValue={profile.photo_url ?? ''}
        placeholder="https://…"
        errors={state.fieldErrors?.photo_url}
      />
      {timezones.length > 0 ? (
        <SelectField
          label="Timezone"
          name="timezone"
          defaultValue={profile.timezone ?? ''}
          options={[
            { value: '', label: '—' },
            ...timezones.map((tz) => ({ value: tz, label: tz })),
          ]}
          errors={state.fieldErrors?.timezone}
        />
      ) : (
        <TextField
          label="Timezone"
          name="timezone"
          defaultValue={profile.timezone ?? ''}
          placeholder="Europe/Amsterdam"
          hint="IANA timezone name"
          errors={state.fieldErrors?.timezone}
        />
      )}

      {state.error && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          {state.error}
        </div>
      )}

      {state.ok && (
        <div className="rounded-md border border-line bg-surface-sunken p-3 text-sm text-ink-subtle">
          Saved.
        </div>
      )}

      <Submit />
    </form>
  );
}
