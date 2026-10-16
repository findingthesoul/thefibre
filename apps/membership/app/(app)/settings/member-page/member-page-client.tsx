'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, GripVertical, Image as ImageIcon, Link2, Trash2 } from 'lucide-react';
import { RichTextField } from '@thefibre/shared/ui/rich-text-field';
import { RichText } from '@thefibre/shared/ui/rich-text';
import { safeLinkUrl } from '@thefibre/shared/member-page';
import { tokenChips } from '@thefibre/shared/merge-tokens';
import { CHIP, CHIP_STATE, NOTICE } from '@thefibre/shared/ui/recipes';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import {
  addMemberLink,
  previewMemberIntro,
  removeMemberDocument,
  renameMemberDocument,
  reorderMemberDocuments,
  saveMemberIntro,
  saveMemberTierIntro,
  setMemberDocumentTiers,
} from '../actions';

// tier_ids: who sees it (2jj). Empty = every member, the behaviour before tiers.
export type MemberDocument =
  | { id: string; title: string; kind: 'file'; mime: string; bytes: number; uploaded_at: string; tier_ids?: string[] }
  | { id: string; title: string; kind: 'link'; url: string; uploaded_at: string; tier_ids?: string[] };
export type PageTier = { id: string; name: string; archived: boolean };
type Preview = { member_name: string | null; intro_html: string | null; tier_sections?: { tier_id: string; tier_name: string; intro_html: string }[] };

const TAG_CHIPS = tokenChips('member_page');

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function MemberPageClient({
  workspaceName,
  intro,
  tierIntros: initialTierIntros = {},
  tiers = [],
  documents: initial,
  locale,
}: {
  workspaceName: string | null;
  intro: string | null;
  tierIntros?: Record<string, string>;
  tiers?: PageTier[];
  documents: MemberDocument[];
  locale: Locale;
}) {
  const router = useRouter();
  // Which text the editor writes (2jj): '' = the whole community, else a
  // tier id. Each tier's section is ADDED under the community's intro.
  const [target, setTarget] = useState('');
  // What is saved, per target — so switching back shows what was saved.
  const [saved, setSaved] = useState<Record<string, string>>({ '': intro ?? '', ...initialTierIntros });
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
  const choosable = tiers.filter((x) => !x.archived || docs.some((d) => d.tier_ids?.includes(x.id)) || saved[x.id]);
  const targetTier = tiers.find((x) => x.id === target) ?? null;
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'upload' | 'link'>('upload');
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
    const r = forTarget ? await saveMemberTierIntro(forTarget, body) : await saveMemberIntro(body);
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

  async function setShownTo(id: string, tierIds: string[]) {
    const before = docs;
    setDocs((d) => d.map((x) => (x.id === id ? { ...x, tier_ids: tierIds } : x)));
    const r = await setMemberDocumentTiers(id, tierIds);
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
        {choosable.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-sm text-ink-subtle">
            {t(locale, 'mp_edit_for')}
            <select
              value={target}
              onChange={(e) => void switchTarget(e.target.value)}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
            >
              <option value="">{t(locale, 'mp_edit_whole')}</option>
              {choosable.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                  {saved[x.id]?.trim() ? ' •' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <RichTextField
          key={target || 'community'}
          locale={locale}
          label={targetTier ? `${t(locale, 'mp_intro_label')} — ${targetTier.name}` : t(locale, 'mp_intro_label')}
          hint={targetTier ? t(locale, 'mp_tier_intro_hint', { tier: targetTier.name }) : t(locale, 'mp_intro_hint')}
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
                {preview.tier_sections?.map((x) => (
                  <div key={x.tier_id} className="mt-4 border-t border-line pt-3">
                    <p className="mb-2 text-xs font-medium text-ink-subtle">{x.tier_name}</p>
                    <RichText html={x.intro_html} />
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
                {d.kind === 'link' ? (
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
                {d.kind === 'link' ? (
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
                {choosable.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 pl-[3.25rem]" role="group" aria-label={`${t(locale, 'mp_shown_to')}: ${d.title}`}>
                    <span className="mr-1 text-xs text-ink-muted">{t(locale, 'mp_shown_to')}</span>
                    <button
                      type="button"
                      aria-pressed={!d.tier_ids?.length}
                      onClick={() => d.tier_ids?.length && void setShownTo(d.id, [])}
                      className={`${CHIP} ${!d.tier_ids?.length ? CHIP_STATE.on : CHIP_STATE.off}`}
                    >
                      {t(locale, 'mp_everyone')}
                    </button>
                    {choosable.map((x) => {
                      const on = !!d.tier_ids?.includes(x.id);
                      return (
                        <button
                          key={x.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => void setShownTo(d.id, on ? (d.tier_ids ?? []).filter((v) => v !== x.id) : [...(d.tier_ids ?? []), x.id])}
                          className={`${CHIP} ${on ? CHIP_STATE.on : CHIP_STATE.off}`}
                        >
                          {x.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center gap-1.5" role="radiogroup" aria-label={t(locale, 'mp_type')}>
            <span className="mr-1 text-sm text-ink-subtle">{t(locale, 'mp_type')}</span>
            {(['upload', 'link'] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={kind === k}
                onClick={() => setKind(k)}
                className={`${CHIP} ${kind === k ? CHIP_STATE.on : CHIP_STATE.off}`}
              >
                {t(locale, k === 'upload' ? 'mp_type_upload' : 'mp_type_link')}
              </button>
            ))}
          </div>
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
        </div>
      </section>

      {error && <p className={NOTICE.error}>{error}</p>}
    </div>
  );
}
