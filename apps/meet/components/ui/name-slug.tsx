'use client';

// Paired Name + URL slug inputs. On create (no initial slug) the slug
// auto-syncs from the name as you type. The slug field shows as locked
// (read-only) with an "Edit" button; clicking it unlocks the field and
// stops the auto-sync so manual edits stick. On edit (initial slug set)
// the field starts unlocked so the user can change it directly.

import { useEffect, useId, useRef, useState } from 'react';
import { TextField } from './field';

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function NameAndSlugFields({
  initialName = '',
  initialSlug = '',
  nameLabel = 'Name',
  slugHint,
  slugPlaceholder = 'auto-generated',
}: {
  initialName?: string;
  initialSlug?: string;
  nameLabel?: string;
  slugHint?: React.ReactNode;
  slugPlaceholder?: string;
}) {
  const isCreate = !initialSlug;
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug || slugify(initialName));
  const [locked, setLocked] = useState(isCreate);
  const slugInputRef = useRef<HTMLInputElement | null>(null);
  const slugId = useId();

  useEffect(() => {
    if (locked) setSlug(slugify(name));
  }, [name, locked]);

  function unlock() {
    setLocked(false);
    // Focus after the input becomes editable.
    requestAnimationFrame(() => slugInputRef.current?.focus());
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <TextField
        label={nameLabel}
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
      />
      <div>
        <div className="flex items-center justify-between">
          <label htmlFor={slugId} className="text-sm text-ink-subtle">
            URL slug <span className="text-red-600">*</span>
          </label>
          {locked && (
            <button
              type="button"
              onClick={unlock}
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
            >
              Edit
            </button>
          )}
        </div>
        <input
          id={slugId}
          ref={slugInputRef}
          name="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9-]/g, ''))}
          readOnly={locked}
          required
          pattern="[a-z0-9-]+"
          placeholder={slugPlaceholder}
          className={`mt-1 w-full rounded-md border px-3 py-2 text-sm focus:outline-none ${
            locked
              ? 'border-line bg-surface-sunken text-ink-subtle cursor-default'
              : 'border-line bg-surface-raised focus:border-line-strong'
          }`}
        />
        {slugHint && (
          <span className="mt-1 block text-xs text-ink-muted">{slugHint}</span>
        )}
      </div>
    </div>
  );
}
