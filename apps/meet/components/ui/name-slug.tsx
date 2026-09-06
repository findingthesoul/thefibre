'use client';

// Single source of truth for "name + URL slug" pairs across the app.
// Layout matches the Thread / Suite reference:
//
//   Name
//   [______________________________]
//
//   Public URL
//   [prefix/]  [slug                                       ]  [ALT]
//
// Behavior:
//   * On create (no initial slug), the slug auto-fills from the name using
//     slugify(). The user can click into the field to override.
//   * On edit (initial slug present), auto-sync is off — typing in Name
//     doesn't touch the slug.
//   * ALT regenerates a slug variant (slugify(name) + 4-char random
//     suffix). Useful when a base slug is taken.

import { useEffect, useId, useRef, useState } from 'react';
import { TextField } from './field';
import { t, DEFAULT_LOCALE, type Locale } from '@/lib/i18n-ui';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function randomSuffix(len = 4): string {
  return Math.random().toString(36).slice(2, 2 + len);
}

export function NameAndSlugFields({
  initialName = '',
  initialSlug = '',
  nameLabel = 'Name',
  prefix = '',
  slugHint,
  slugLabel = 'Public URL',
  locale = DEFAULT_LOCALE,
}: {
  initialName?: string;
  initialSlug?: string;
  nameLabel?: string;
  /** Read-only prefix shown to the left of the slug field, e.g. `meet.thefibre.app/sjoerd/`. */
  prefix?: string;
  slugHint?: React.ReactNode;
  slugLabel?: string;
  locale?: Locale;
}) {
  const isCreate = !initialSlug;
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug || slugify(initialName));
  // autoSync follows the name only until the user manually edits the slug or
  // clicks ALT (both signal "I'm picking my own").
  const [autoSync, setAutoSync] = useState(isCreate);
  const slugInputRef = useRef<HTMLInputElement | null>(null);
  const slugId = useId();

  useEffect(() => {
    if (autoSync) setSlug(slugify(name));
  }, [name, autoSync]);

  function onSlugChange(value: string) {
    setAutoSync(false);
    setSlug(value.replace(/[^a-z0-9-]/g, ''));
  }

  function regenerate() {
    setAutoSync(false);
    const base = slugify(name) || 'meeting';
    setSlug(`${base}-${randomSuffix()}`);
    requestAnimationFrame(() => slugInputRef.current?.focus());
  }

  return (
    <div className="space-y-5">
      <TextField
        label={nameLabel}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div>
        <label htmlFor={slugId} className="block text-sm text-ink-subtle">
          {slugLabel} <span className="text-red-600">*</span>
        </label>
        <div className="mt-1 flex items-stretch rounded-md border border-line bg-surface-raised overflow-hidden focus-within:border-line-strong">
          {prefix && (
            <span className="px-3 flex items-center text-sm text-ink-muted bg-surface-sunken border-r border-line whitespace-nowrap">
              {prefix}
            </span>
          )}
          <input
            id={slugId}
            ref={slugInputRef}
            name="slug"
            value={slug}
            onChange={(e) => onSlugChange(e.target.value)}
            required
            pattern="[a-z0-9-]+"
            placeholder={t(locale, 'slug_auto_placeholder')}
            className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none placeholder:text-ink-muted min-w-0"
          />
          <button
            type="button"
            onClick={regenerate}
            className="px-3 flex items-center text-xs uppercase tracking-wider text-ink-subtle hover:text-ink hover:bg-surface-sunken border-l border-line"
            title={t(locale, 'slug_alt_title')}
          >
            Alt
          </button>
        </div>
        {slugHint && (
          <span className="mt-1 block text-xs text-ink-muted">{slugHint}</span>
        )}
      </div>
    </div>
  );
}
