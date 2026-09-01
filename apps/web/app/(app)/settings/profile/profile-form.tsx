'use client';

import { ProfileForm as SharedProfileForm } from '@thefibre/shared/ui/profile-form';
import { uploadAsset } from '@/lib/upload';
import { saveProfile } from '../actions';

/**
 * The Fibre's profile IS the shared form — same component The Thread renders,
 * so the two cannot drift again by rearrangement, which is exactly how they
 * differed after the last attempt (same fields, same field kit, different
 * layout).
 *
 * What is local: where it saves. The platform profile, plus the user row the
 * sidebar and member list read, kept in step by saveProfile.
 *
 * No public URL field. An organiser page has an address; your platform profile
 * is not a page.
 */
export type PublicProfile = {
  display_name: string | null;
  bio: string | null;
  photo_url: string | null;
  timezone: string | null;
};

export function ProfileForm({ profile, email }: { profile: PublicProfile; email: string }) {
  return (
    <SharedProfileForm
      initial={{
        display_name: profile.display_name ?? '',
        bio: profile.bio ?? '',
        photo_url: profile.photo_url ?? null,
        timezone: profile.timezone ?? '',
      }}
      upload={uploadAsset}
      photoHint="Shown wherever the apps show you."
      bioHint="Shown on your public pages in the apps that have them."
      onSave={async (v) => {
        const r = await saveProfile({
          display_name: v.display_name || null,
          bio: v.bio || null,
          photo_url: v.photo_url,
          timezone: v.timezone || null,
        });
        return { ok: !!r.ok, error: r.error };
      }}
      footer={
        <p className="text-xs text-ink-muted">
          Signed in as {email}. Every app inherits this profile — The Thread and Meet can override
          the name and photo on their own public pages.
        </p>
      }
    />
  );
}
