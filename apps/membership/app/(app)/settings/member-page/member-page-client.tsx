'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, GripVertical, Image as ImageIcon, Trash2 } from 'lucide-react';
import { RichTextField } from '@thefibre/shared/ui/rich-text-field';
import { NOTICE } from '@thefibre/shared/ui/recipes';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import {
  removeMemberDocument,
  renameMemberDocument,
  reorderMemberDocuments,
  saveMemberIntro,
} from '../actions';

export type MemberDocument = { id: string; title: string; mime: string; bytes: number; uploaded_at: string };

const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function MemberPageClient({
  intro,
  documents: initial,
  locale,
}: {
  intro: string | null;
  documents: MemberDocument[];
  locale: Locale;
}) {
  const router = useRouter();
  const [html, setHtml] = useState(intro ?? '');
  const [docs, setDocs] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function saveIntro() {
    setBusy('intro');
    setError(null);
    setSaved(false);
    const r = await saveMemberIntro(html.trim() ? html : null);
    setBusy(null);
    if (r.error) setError(r.error);
    else setSaved(true);
  }

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
      <section className="rounded-lg border border-line bg-surface-raised p-5 space-y-4">
        <RichTextField
          locale={locale}
          label={t(locale, 'mp_intro_label')}
          hint={t(locale, 'mp_intro_hint')}
          name="intro_html"
          defaultValue={intro}
          onHtmlChange={setHtml}
          minHeight={180}
        />
        <div className="flex items-center gap-3">
          <Button type="button" variant="save" onClick={saveIntro} disabled={busy === 'intro'}>
            {busy === 'intro' ? t(locale, 'saving') : t(locale, 'mp_save_intro')}
          </Button>
          {saved && <span className="text-sm text-ink-muted">{t(locale, 'saved_dot')}</span>}
        </div>
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
                className={`flex items-center gap-3 px-3 py-2 ${dragIdx === i ? 'opacity-50' : ''}`}
              >
                <GripVertical size={16} className="shrink-0 cursor-grab text-ink-muted" aria-hidden />
                {d.mime === 'application/pdf' ? (
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
                <span className="shrink-0 text-xs text-ink-muted">{size(d.bytes)}</span>
                <button
                  type="button"
                  onClick={() => void remove(d.id)}
                  disabled={busy === d.id}
                  aria-label={t(locale, 'mp_remove')}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle hover:bg-surface-sunken hover:text-ink"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm text-ink-subtle">
            {t(locale, 'mp_title')}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t(locale, 'mp_title_placeholder')}
              className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm text-ink focus:border-line-strong focus:outline-none"
            />
          </label>
          <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="text-sm" />
          <Button type="button" onClick={upload} disabled={busy === 'upload'}>
            {busy === 'upload' ? t(locale, 'mp_uploading') : t(locale, 'mp_upload')}
          </Button>
        </div>
        <p className="text-xs text-ink-muted">{t(locale, 'mp_upload_hint')}</p>
      </section>

      {error && <p className={NOTICE.error}>{error}</p>}
    </div>
  );
}
