'use client';

// Your profile — THE profile, not a copy (Sjoerd, 2026-10-16: "The profile
// here is the same profile as people would have in the Thread. Not a new
// profile." and "If people later become part of the thread, this profile can
// also be used.").
//
// So this renders the SHARED ProfileForm, the one The Fibre's Settings →
// Profile renders, and it saves to the same record: identity_profile, keyed
// by the verified email (PATCH /me/profile `face`). Only the two app-bound
// pieces are local: where the photo goes up, and where the save goes.
//
// The photo is saved the moment it is chosen (POST /me/profile/photo), so the
// save below never sends a URL — only `null`, when the photo was removed.

import { useRef } from 'react';
import { ProfileForm } from '@thefibre/shared/ui/profile-form';
import { useLocale } from '@thefibre/shared/ui/i18n-ui';
import { ProfileFieldError, saveProfile, uploadProfilePhoto, type ProfileFace as Face } from '@/lib/portal-api';
import { preparePhoto } from '@/lib/photo-prep';
import { t } from '@/lib/i18n';

/** Under the hosting limit on a function's request body (~4.5 MB). */
const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

export function ProfileFace({ face, fallbackName }: { face: Face; fallbackName: string }) {
  const locale = useLocale();
  // Whether the SERVER holds a photo now: the one the page loaded with, or
  // one uploaded since (an upload saves at once). Removing it then sends null.
  const serverHasPhoto = useRef(Boolean(face.photo_url));
  return (
    <section className="mt-12">
      <h2 className="text-sm font-medium text-ink">{t(locale, 'face_title')}</h2>
      <p className="mt-1 text-xs text-ink-muted">{t(locale, 'face_desc')}</p>
      <ProfileForm
        initial={{
          display_name: face.display_name ?? fallbackName,
          bio: face.bio ?? '',
          short_bio: face.short_bio ?? '',
          photo_url: face.photo_url,
          timezone: face.timezone ?? '',
          city: face.city ?? '',
          website_url: face.website_url ?? '',
          linkedin_url: face.linkedin_url ?? '',
        }}
        upload={async (file) => {
          const prepared = await preparePhoto(file);
          // The canvas output is a few hundred KB. When the browser could not
          // redraw it (an old browser, a HEIC it cannot decode) the ORIGINAL
          // goes up instead, and a hosted function refuses a request body
          // past ~4.5 MB with a page that is not JSON. Refuse here, in words.
          if (prepared.size > PHOTO_MAX_BYTES) throw new Error(t(locale, 'face_photo_too_big'));
          const url = await uploadProfilePhoto(prepared);
          serverHasPhoto.current = true;
          return url;
        }}
        photoHint={t(locale, 'face_photo_hint')}
        onSave={async (v) => {
          try {
            await saveProfile({
              face: {
                display_name: v.display_name,
                bio: v.bio,
                short_bio: v.short_bio,
                timezone: v.timezone,
                city: v.city,
                website_url: v.website_url,
                linkedin_url: v.linkedin_url,
                ...(serverHasPhoto.current && !v.photo_url ? { photo_url: null } : {}),
              },
            });
            if (!v.photo_url) serverHasPhoto.current = false;
            return { ok: true };
          } catch (e) {
            if (e instanceof ProfileFieldError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
            return { ok: false, error: e instanceof Error ? e.message : t(locale, 'did_not_save') };
          }
        }}
      />
    </section>
  );
}
