'use client';

import { ProfileForm as SharedProfileForm } from '@thefibre/shared/ui/profile-form';
import { PublicPageSwitch, type PublicPage } from '@thefibre/shared/ui/public-page-switch';
import { uploadAsset } from '@/lib/upload';
import { saveProfile, setPublicPage } from '../actions';
import { t, type Locale } from '@/lib/i18n-ui';

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
  /** Optional on the type: an API that predates the column omits it. */
  short_bio?: string | null;
  photo_url: string | null;
  timezone: string | null;
  /** UI + email language (i18n P2) — edited by LanguagePicker, not this form. */
  locale?: string | null;
  /** The To do panel's on/off — edited by TodoPref, not this form. */
  todo_enabled?: boolean;
  /** This person's public organiser page, when they have one. Null for the
   *  many people who do not, and absent from an API that predates it. */
  public_page?: PublicPage | null;
};

export function ProfileForm({
  profile,
  email,
  locale,
  threadAppUrl,
}: {
  profile: PublicProfile;
  email: string;
  locale: Locale;
  /** Where an organiser page lives, so the switch can show the address.
   *  Optional: the welcome flow renders this form too, and somebody being
   *  welcomed has no page to decide about — nor any business being asked
   *  about one before they have arrived. */
  threadAppUrl?: string;
}) {
  return (
    <>
    <SharedProfileForm
      initial={{
        display_name: profile.display_name ?? '',
        bio: profile.bio ?? '',
        short_bio: profile.short_bio ?? '',
        photo_url: profile.photo_url ?? null,
        timezone: profile.timezone ?? '',
      }}
      upload={uploadAsset}
      photoHint={t(locale, 'photo_hint')}
      bioHint={t(locale, 'bio_hint')}
      onSave={async (v) => {
        const r = await saveProfile({
          display_name: v.display_name || null,
          bio: v.bio || null,
          short_bio: v.short_bio || null,
          photo_url: v.photo_url,
          timezone: v.timezone || null,
        });
        return { ok: !!r.ok, error: r.error, fieldErrors: r.fieldErrors };
      }}
      footer={
        <p className="text-xs text-ink-muted">
          {t(locale, 'signed_in_as', { email })} {t(locale, 'profile_inherit_note')}
        </p>
      }
    />
    {/* BELOW the form, not inside it: this is about a page some people have
        and most do not, and the shared form is about the profile every
        person has. It renders nothing when there is no page. */}
    <PublicPageSwitch
      page={threadAppUrl ? (profile.public_page ?? null) : null}
      pageUrl={(slug) => `${threadAppUrl ?? ''}/${slug}`}
      onChange={async (published) => {
        const r = await setPublicPage(published);
        return { ok: !!r.ok, error: r.error };
      }}
    />
    </>
  );
}
