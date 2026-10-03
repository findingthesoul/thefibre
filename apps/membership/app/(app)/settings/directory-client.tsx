'use client';

// The member directory's admin screen (docs/member-directory-spec.md slice 1).
//
// Two halves on one page on purpose: the switches decide who sees whom, and
// the categories are what `category` mode resolves against. Split across two
// screens, an admin can turn on category mode without ever meeting the fact
// that they have no categories.
//
// Sjoerd, on the questions behind it: "categories -> workspace (category only
// see categroy, or everybody sees everybody)" and "Maybe contact details can
// be a check. (Default for a group and personally adaptable)."

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import type { DirectoryCategory } from './shared';
import { createCategory, patchCategory, saveDirectorySettings } from './actions';

const INPUT =
  'w-full rounded-md border border-line bg-surface-raised px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300';

export function DirectoryClient({
  visibility: initialVisibility,
  showContact: initialShowContact,
  showCategory: initialShowCategory,
  defaultCategoryId: initialDefaultCategoryId,
  categories,
  uncategorised,
  locale,
}: {
  visibility: 'everybody' | 'category';
  showContact: boolean;
  showCategory: boolean;
  defaultCategoryId: string | null;
  categories: DirectoryCategory[];
  /** Products carrying no category — §9.3. The count IS the feature. */
  uncategorised: { count: number; items: { id: string; name: string }[] };
  locale: Locale;
}) {
  const router = useRouter();
  const [visibility, setVisibility] = useState(initialVisibility);
  const [showContact, setShowContact] = useState(initialShowContact);
  const [showCategory, setShowCategory] = useState(initialShowCategory);
  const [defaultCategoryId, setDefaultCategoryId] = useState(initialDefaultCategoryId);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Categories save one at a time, immediately — a list is not a form.
  const [newName, setNewName] = useState('');
  const [catBusy, setCatBusy] = useState(false);
  const [catError, setCatError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const r = await saveDirectorySettings({
      directory_visibility: visibility,
      directory_show_contact: showContact,
      directory_show_category: showCategory,
      directory_default_category_id: defaultCategoryId,
    });
    setBusy(false);
    if (r.error) setError(r.error);
    else {
      setSaved(true);
      router.refresh();
    }
  }

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    setCatBusy(true);
    setCatError(null);
    const r = await createCategory(name);
    setCatBusy(false);
    if (r.error) {
      setCatError(r.error);
      return;
    }
    setNewName('');
    router.refresh();
  }

  async function rename(id: string) {
    const name = editName.trim();
    if (!name) return;
    setCatBusy(true);
    setCatError(null);
    const r = await patchCategory(id, { name });
    setCatBusy(false);
    if (r.error) {
      setCatError(r.error);
      return;
    }
    setEditing(null);
    router.refresh();
  }

  async function toggleArchived(c: DirectoryCategory) {
    setCatBusy(true);
    setCatError(null);
    const r = await patchCategory(c.id, { archived: !c.archived_at });
    setCatBusy(false);
    if (r.error) {
      setCatError(r.error);
      return;
    }
    // Archiving the category that products fall back to would make §9.3 fail
    // closed again without anybody choosing that, so it is unset here too.
    if (!c.archived_at && defaultCategoryId === c.id) setDefaultCategoryId(null);
    router.refresh();
  }

  const live = categories.filter((c) => !c.archived_at);

  return (
    <div className="space-y-6">
      {/* ── who sees whom ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-line">
        <div className="border-b border-line bg-surface-sunken px-5 py-3">
          <h2 className="text-sm font-medium text-ink">{t(locale, 'directory_who_sees_whom')}</h2>
        </div>
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t(locale, 'directory_visibility_label')}
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as 'everybody' | 'category')}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none"
            >
              <option value="everybody">{t(locale, 'directory_vis_everybody')}</option>
              <option value="category">{t(locale, 'directory_vis_category')}</option>
            </select>
          </div>

          {/* §9.3 — the count is the feature. Shown only where it bites: in
              `everybody` mode categories gate nothing. */}
          {visibility === 'category' && uncategorised.count > 0 && !defaultCategoryId && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {t(locale, 'directory_uncategorised_warning', { count: uncategorised.count })}
              {uncategorised.items.length > 0 && (
                <span className="mt-1 block text-xs text-amber-800">
                  {uncategorised.items.map((p) => p.name).join(', ')}
                </span>
              )}
            </p>
          )}

          {visibility === 'category' && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                {t(locale, 'directory_default_category_label')}
              </label>
              <select
                value={defaultCategoryId ?? ''}
                onChange={(e) => setDefaultCategoryId(e.target.value || null)}
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm focus:border-line-strong focus:outline-none"
              >
                <option value="">{t(locale, 'directory_default_none')}</option>
                {live.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-muted">
                {t(locale, 'directory_default_category_hint')}
              </p>
            </div>
          )}

          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={showContact}
              onChange={(e) => setShowContact(e.target.checked)}
              className="mt-0.5 accent-ink"
            />
            <span>
              <span className="text-ink">{t(locale, 'directory_show_contact_label')}</span>
              <span className="block text-xs text-ink-muted">
                {t(locale, 'directory_show_contact_hint')}
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={showCategory}
              onChange={(e) => setShowCategory(e.target.checked)}
              className="mt-0.5 accent-ink"
            />
            <span>
              <span className="text-ink">{t(locale, 'directory_show_category_label')}</span>
              {/* §9.2 — the sentence that matters, beside the switch and not
                  in a doc: this is the disclosure the admin is deciding. */}
              <span className="block text-xs text-ink-muted">
                {t(locale, 'directory_show_category_hint')}
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-ink-muted">{t(locale, 'saved_dot')}</p>}
          <Button type="button" onClick={save} disabled={busy}>
            {busy ? t(locale, 'saving') : t(locale, 'save')}
          </Button>
        </div>
      </section>

      {/* ── the vocabulary ────────────────────────────────────────────── */}
      <section className="rounded-lg border border-line">
        <div className="border-b border-line bg-surface-sunken px-5 py-3">
          <h2 className="text-sm font-medium text-ink">{t(locale, 'directory_categories_title')}</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {t(locale, 'directory_categories_desc')}
          </p>
        </div>
        <div className="p-5">
          {live.length === 0 && (
            <p className="mb-4 text-sm text-ink-muted">{t(locale, 'directory_no_categories')}</p>
          )}
          <ul className="mb-4 divide-y divide-line">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-2.5">
                {editing === c.id ? (
                  <>
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void rename(c.id);
                        }
                        if (e.key === 'Escape') setEditing(null);
                      }}
                      className={INPUT}
                      autoFocus
                    />
                    <Button type="button" onClick={() => void rename(c.id)} disabled={catBusy}>
                      {t(locale, 'save')}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="text-sm text-ink-muted hover:text-ink"
                    >
                      {t(locale, 'cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      className={`flex-1 text-sm ${c.archived_at ? 'text-ink-muted line-through' : 'text-ink'}`}
                    >
                      {c.name}
                    </span>
                    {!c.archived_at && (
                      <button
                        type="button"
                        aria-label={t(locale, 'rename')}
                        onClick={() => {
                          setEditing(c.id);
                          setEditName(c.name);
                        }}
                        className="text-ink-muted hover:text-ink"
                      >
                        <Pencil size={15} strokeWidth={1.75} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void toggleArchived(c)}
                      disabled={catBusy}
                      className="text-xs text-ink-muted hover:text-ink"
                    >
                      {c.archived_at ? t(locale, 'unarchive') : t(locale, 'archive')}
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addCategory();
                }
              }}
              placeholder={t(locale, 'directory_new_category_ph')}
              className={INPUT}
            />
            <Button type="button" onClick={() => void addCategory()} disabled={catBusy || !newName.trim()}>
              <Plus size={15} strokeWidth={2} className="mr-1 inline" />
              {t(locale, 'add')}
            </Button>
          </div>
          {catError && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-red-600">
              <X size={15} strokeWidth={2} className="mt-0.5 shrink-0" />
              {catError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
