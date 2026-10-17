'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Folder, GripVertical, Image as ImageIcon, Link2, Trash2 } from 'lucide-react';
import { RichTextField } from '@thefibre/shared/ui/rich-text-field';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { safeLinkUrl } from '@thefibre/shared/member-page';
import { tokenChips } from '@thefibre/shared/merge-tokens';
import { CHIP, CHIP_STATE, NOTICE } from '@thefibre/shared/ui/recipes';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { AudienceChips } from './audience-chips';
import { DriveConnect } from './drive-connect';
import {
  addMemberLink,
  previewMemberIntro,
  removeMemberDocument,
  renameMemberDocument,
  reorderMemberDocuments,
  saveMemberIntro,
  saveMemberCategoryIntro,
  saveMemberTierIntro,
  setMemberDocumentAudience,
} from '../actions';

// tier_ids: who sees it (2jj). Empty = every member, the behaviour before tiers.
export type MemberDocument =
  | { id: string; title: string; kind: 'file'; mime: string; bytes: number; uploaded_at: string; tier_ids?: string[]; category_ids?: string[] }
  | { id: string; title: string; kind: 'link'; url: string; uploaded_at: string; tier_ids?: string[]; category_ids?: string[] }
  // A connected Google Drive folder (2026-10-17): members browse it in
  // my.thread → Files; same order, same audience as every other entry.
  | { id: string; title: string; kind: 'drive'; folder_id: string; uploaded_at: string; tier_ids?: string[]; category_ids?: string[] };
export type PageTier = { id: string; name: string; archived: boolean };
type Preview = {
  member_name: string | null;
  intro_html: string | null;
  tier_sections?: { tier_id: string; tier_name: string; intro_html: string }[];
  category_sections?: { category_id: string; category_name: string; intro_html: string }[];
};
/** The editor's target: '' (the community), 't:<tier>' or 'c:<category>'. */
const tierKey = (id: string) => `t:${id}`;
const catKey = (id: string) => `c:${id}`;

const TAG_CHIPS = tokenChips('member_page');

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function MemberPageClient({
  workspaceName,
  intro,
  tierIntros: initialTierIntros = {},
  tiers = [],
  categoryIntros: initialCategoryIntros = {},
  categories = [],
  documents: initial,
  locale,
}: {
  workspaceName: string | null;
  intro: string | null;
  tierIntros?: Record<string, string>;
  tiers?: PageTier[];
  categoryIntros?: Record<string, string>;
  categories?: PageTier[];
  documents: MemberDocument[];
  locale: Locale;
}) {
  const router = useRouter();
  // Which text the editor writes (2jj): '' = the whole community, 't:<id>'
  // a tier, 'c:<id>' a directory category. Each section is ADDED under the
  // community's intro.
  const [target, setTarget] = useState('');
  // What is saved, per target — so switching back shows what was saved.
  const [saved, setSaved] = useState<Record<string, string>>(() => ({
    '': intro ?? '',
    ...Object.fromEntries(Object.entries(initialTierIntros).map(([k, v]) => [tierKey(k), v])),
    ...Object.fromEntries(Object.entries(initialCategoryIntros).map(([k, v]) => [catKey(k), v])),
  }));
  const [html, setHtml] = useState(intro ?? '');
  const [docs, setDocs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // ONE SAVE MODEL for the page: documents save the moment they are added,
  // so the introduction does too — when the field loses focus. A Save button
  // beside instant documents was a trap: type, wander off, nothing saved
  // (Sjoerd on production, 2026-10-14).
  const savedHtml = saved[target] ?? '';
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const dirty = html !== savedHtml || saveState === 'saving';
  // Live tiers to choose from, plus an archived one a document still names.
  const choosable = tiers.filter((x) => !x.archived || docs.some((d) => d.tier_ids?.includes(x.id)) || saved[tierKey(x.id)]);
  const choosableCats = categories.filter((x) => !x.archived || docs.some((d) => d.category_ids?.includes(x.id)) || saved[catKey(x.id)]);
  const targetName =
    tiers.find((x) => tierKey(x.id) === target)?.name ?? categories.find((x) => catKey(x.id) === target)?.name ?? null;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'upload' | 'link' | 'drive'>('upload');
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function addLink() {
    // The same rule the API applies, so the refusal comes before the save.
    if (!safeLinkUrl(url)) return setError(t(locale, 'mp_bad_url'));
    setBusy('link');
    setError(null);
    const r = await addMemberLink(url.trim(), title.trim() || null);
    setBusy(null);
    if (r.error || !r.data) return setError(r.error ?? t(locale, 'mp_bad_url'));
    setDocs((d) => [...d, r.data!]);
    setTitle('');
    setUrl('');
    router.refresh();
  }

  async function togglePreview() {
    if (preview) return setPreview(null);
    // The preview reads what is SAVED, so whatever is typed is saved first.
    await saveIntro();
    setBusy('preview');
    setError(null);
    const r = await previewMemberIntro();
    setBusy(null);
    if (r.error || !r.data) setError(r.error ?? 'preview failed');
    else setPreview(r.data);
  }

  async function saveIntro() {
    if (html === savedHtml) return;
    const sending = html;
    const forTarget = target;
    setSaveState('saving');
    setError(null);
    const body = sending.trim() ? sending : null;
    const r = forTarget.startsWith('t:')
      ? await saveMemberTierIntro(forTarget.slice(2), body)
      : forTarget.startsWith('c:')
        ? await saveMemberCategoryIntro(forTarget.slice(2), body)
        : await saveMemberIntro(body);
    if (r.error) {
      setSaveState('idle');
      setError(r.error);
      return;
    }
    setSaved((m) => ({ ...m, [forTarget]: sending }));
    setSaveState('saved');
  }

  // Switching what is written saves what was typed first, then loads the
  // other text into the editor (which is keyed on the target).
  async function switchTarget(next: string) {
    await saveIntro();
    setTarget(next);
    setHtml(saved[next] ?? '');
    setSaveState('idle');
    setPreview(null);
  }

  async function setShownTo(id: string, audience: { tier_ids: string[]; category_ids: string[] }) {
    const before = docs;
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, ...audience } : x)));
    const r = await setMemberDocumentAudience(id, audience);
    if (r.error) {
      setDocs(before);
      setError(r.error);
    }
  }

  // Leaving with text not yet saved (or a save still in flight) asks first.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setBusy('upload');
    setError(null);
    const fd = new FormData();
    fd.set('file', file);
    if (title.trim()) fd.set('title', title.trim());
    const res = await fetch('/api/member-page/documents', { method: 'POST', body: fd }).catch(() => null);
    setBusy(null);
    const body = (await res?.json().catch(() => ({}))) as { error?: string } & Partial<MemberDocument>;
    if (!res?.ok) {
      setError(body.error ?? t(locale, 'mp_upload_failed'));
      return;
    }
    setDocs((d) => [...d, body as MemberDocument]);
    setTitle('');
    if (fileRef.current) fileRef.current.value = '';
    router.refresh();
  }

  // Ordering is drag-and-drop, never a number field (Sjoerd, 2026-09-05).
  async function dropOn(i: number) {
    if (dragIdx === null || dragIdx === i) return setDragIdx(null);
    const next = [...docs];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(i, 0, moved!);
    setDocs(next);
    setDragIdx(null);
    const r = await reorderMemberDocuments(next.map((d) => d.id));
    if (r.error) {
      setDocs(docs);
      setError(r.error);
    }
  }

  async function rename(id: string, value: string) {
    const before = docs;
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, title: value } : x)));
    const r = await renameMemberDocument(id, value);
    if (r.error) {
      setDocs(before);
      setError(r.error);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t(locale, 'mp_remove_confirm'))) return;
    setBusy(id);
    const r = await removeMemberDocument(id);
    setBusy(null);
    if (r.error) setError(r.error);
    else setDocs((d) => d.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-8">
      {workspaceName && (
        <p className="text-sm text-ink-subtle">{t(locale, 'mp_audience', { community: workspaceName })}</p>
      )}
      <section
        className="rounded-lg border border-line bg-surface-raised p-5 space-y-4"
        // Saves when focus leaves the field for anywhere outside this box —
        // the tag chips keep focus in the editor, so inserting one does not.
        onBlur={(e) => {
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
          void saveIntro();
        }}
      >
        {choosable.length + choosableCats.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
            {t(locale, 'mp_edit_for')}
            <select
              value={target}
              onChange={(e) => void switchTarget(e.target.value)}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">{t(locale, 'mp_edit_whole')}</option>
              {choosable.length > 0 && (
                <optgroup label={t(locale, 'mp_tiers_group')}>
                  {choosable.map((x) => (
                    <option key={x.id} value={tierKey(x.id)}>
                      {x.name}
                      {saved[tierKey(x.id)]?.trim() ? ' •' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {choosableCats.length > 0 && (
                <optgroup label={t(locale, 'mp_categories_group')}>
                  {choosableCats.map((x) => (
                    <option key={x.id} value={catKey(x.id)}>
                      {x.name}
                      {saved[catKey(x.id)]?.trim() ? ' •' : ''}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        )}
        <RichTextField
          key={target || 'community'}
          locale={locale}
          label={targetName ? `${t(locale, 'mp_intro_label')} — ${targetName}` : t(locale, 'mp_intro_label')}
          hint={targetName ? t(locale, 'mp_tier_intro_hint', { tier: targetName }) : t(locale, 'mp_intro_hint')}
          name="intro_html"
          defaultValue={savedHtml}
          onHtmlChange={setHtml}
          minHeight={180}
          insertTokens={TAG_CHIPS}
        />
        <p className="text-xs text-ink-muted">{t(locale, 'mp_tags_hint')}</p>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-muted" aria-live="polite">
            {saveState === 'saving'
              ? t(locale, 'saving')
              : html !== savedHtml
                ? t(locale, 'mp_unsaved')
                : saveState === 'saved'
                  ? t(locale, 'saved_dot')
                  : t(locale, 'mp_autosaves')}
          </span>
          <Button type="button" variant="ghost" onClick={togglePreview} disabled={busy === 'preview'}>
            {preview ? t(locale, 'mp_preview_close') : t(locale, 'mp_preview')}
          </Button>
        </div>
        {preview && (
          <div className="rounded-md border border-line bg-surface p-4">
            {preview.member_name ? (
              <>
                <p className="mb-3 text-xs text-ink-muted">{t(locale, 'mp_preview_as', { name: preview.member_name })}</p>
                {preview.intro_html ? <RichText html={preview.intro_html} /> : null}
                {[
                  ...(preview.tier_sections ?? []).map((x) => ({ key: x.tier_id, name: x.tier_name, html: x.intro_html })),
                  ...(preview.category_sections ?? []).map((x) => ({ key: x.category_id, name: x.category_name, html: x.intro_html })),
                ].map((x) => (
                  <div key={x.key} className="mt-4 border-t border-line pt-3">
                    <p className="mb-2 text-xs font-medium text-ink-subtle">{x.name}</p>
                    <RichText html={x.html} />
                  </div>
                ))}
              </>
            ) : (
              <p className="text-sm text-ink-muted">{t(locale, 'mp_preview_none')}</p>
            )}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-line bg-surface-raised p-5 space-y-4">
        <h2 className="text-sm font-medium text-ink">{t(locale, 'mp_documents')}</h2>
        {docs.length === 0 ? (
          <p className="text-sm text-ink-muted">{t(locale, 'mp_no_documents')}</p>
        ) : (
          <ul className="divide-y divide-line rounded-md border border-line">
            {docs.map((d, i) => (
              <li
                key={d.id}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => void dropOn(i)}
                className={`px-3 py-2 ${dragIdx === i ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                <GripVertical size={16} className="shrink-0 cursor-grab text-ink-muted" aria-hidden />
                {d.kind === 'drive' ? (
                  <Folder size={16} className="shrink-0 text-ink-subtle" aria-hidden />
                ) : d.kind === 'link' ? (
                  <Link2 size={16} className="shrink-0 text-ink-subtle" aria-hidden />
                ) : d.mime === 'application/pdf' ? (
                  <FileText size={16} className="shrink-0 text-ink-subtle" aria-hidden />
                ) : (
                  <ImageIcon size={16} className="shrink-0 text-ink-subtle" aria-hidden />
                )}
                <input
                  defaultValue={d.title}
                  aria-label={t(locale, 'mp_title')}
                  onBlur={(e) => e.target.value.trim() && e.target.value !== d.title && void rename(d.id, e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm hover:border-line focus:border-line-strong focus:outline-none"
                />
                {d.kind === 'drive' ? (
                  <span className="shrink-0 text-xs text-ink-muted">{t(locale, 'mp_type_drive')}</span>
                ) : d.kind === 'link' ? (
                  <a href={d.url} target="_blank" rel="noopener noreferrer" className="max-w-[12rem] shrink-0 truncate text-xs text-ink-muted underline underline-offset-2">
                    {new URL(d.url).hostname}
                  </a>
                ) : (
                  <span className="shrink-0 text-xs text-ink-muted">{size(d.bytes)}</span>
                )}
                <button
                  type="button"
                  onClick={() => void remove(d.id)}
                  disabled={busy === d.id}
                  aria-label={t(locale, 'mp_remove')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-sunken hover:text-ink"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
                </div>
                <div className="mt-1.5 pl-[3.25rem]">
                  <AudienceChips
                    value={d}
                    onChange={(next) => void setShownTo(d.id, next)}
                    tiers={choosable}
                    categories={choosableCats}
                    label={`${t(locale, 'mp_shown_to')}: ${d.title}`}
                    locale={locale}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t(locale, 'mp_type')}>
            <span className="mr-1 text-sm text-ink-subtle">{t(locale, 'mp_type')}</span>
            {(['upload', 'link', 'drive'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`${CHIP} ${kind === k ? CHIP_STATE.on : CHIP_STATE.off}`}
              >
                {t(locale, k === 'upload' ? 'mp_type_upload' : k === 'link' ? 'mp_type_link' : 'mp_type_drive')}
              </button>
            ))}
          </div>
          {kind === 'drive' ? (
            <DriveConnect
              locale={locale}
              onConnected={(entry) => {
                setDocs((d) => [...d, entry]);
                router.refresh();
              }}
            />
          ) : (
            <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-ink-subtle">
              {t(locale, 'mp_title')}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t(locale, kind === 'link' ? 'mp_link_title_placeholder' : 'mp_title_placeholder')}
                className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
              />
            </label>
            {kind === 'upload' ? (
              <>
                <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="text-sm" />
                <Button type="button" onClick={upload} disabled={busy === 'upload'}>
                  {busy === 'upload' ? t(locale, 'mp_uploading') : t(locale, 'mp_upload')}
                </Button>
              </>
            ) : (
              <>
                <label className="flex min-w-[14rem] flex-[2] flex-col gap-1 text-sm text-ink-subtle">
                  {t(locale, 'mp_url')}
                  <input
                    type="url"
                    inputMode="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://"
                    className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
                  />
                </label>
                <Button type="button" onClick={addLink} disabled={busy === 'link' || !url.trim()}>
                  {t(locale, 'mp_add_link')}
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-ink-muted">{t(locale, kind === 'link' ? 'mp_link_hint' : 'mp_upload_hint')}</p>
            </>
          )}
        </div>
      </section>

      {error && <p className={NOTICE.error}>{error}</p>}
    </div>
  );
}
