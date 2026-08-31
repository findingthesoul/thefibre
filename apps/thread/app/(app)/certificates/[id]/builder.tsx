'use client';

// The certificate template builder — port of thethread-v3's cert-builder
// into the Fibre design system. One canvas, absolute-positioned elements in
// page-percentage coordinates, drag to move, double-click text to edit
// inline, a properties bar above the canvas, 2s debounced auto-save.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ChevronsDown,
  ChevronsUp,
  Image as ImageIcon,
  ImagePlus,
  Italic,
  Archive,
  Minus,
  Plus,
  Share2,
  Trash2,
  Type,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';
import { uploadAsset } from '@/lib/upload';
import type { TeamOption, WorkspaceMember } from '@/lib/thread-types';
import {
  FIELD_OPTIONS,
  FONT_OPTIONS,
  PAGE_ASPECT,
  elFontStyle,
  generateElementId,
  resolveDisplay,
  type CertElement,
  type CertField,
  type CertOrientation,
  type CertPageSize,
  type CertScope,
  type CertShares,
  type CertTemplate,
} from '@/lib/certificate-types';
import {
  archiveCertificateTemplate,
  deleteCertificateTemplate,
  updateCertificateTemplate,
} from '../actions';
import { ShareDialog } from './share-dialog';

// Brand accent (yellow-300) for selection outlines and centre guides.
const ACCENT = '#fde047';
const GUIDE = 'rgba(253, 224, 71, 0.45)';
const INK_DEFAULT = '#1a1a2e';

// Compact toolbar control — same tokens as field.tsx, without the mt-1
// label shell.
const CONTROL =
  'h-9 rounded-md border border-line bg-surface-raised px-2.5 text-sm text-ink focus:border-line-strong focus:outline-none';

// Small square toggle used for bold/italic/align/arrange.
function toggleCls(active: boolean): string {
  return `inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
    active
      ? 'bg-ink text-ink-inverse border-ink'
      : 'border-line text-ink-subtle hover:text-ink hover:bg-surface-sunken'
  }`;
}

// Upload-first image picker. Block layout for the left panel (background),
// inline layout for the horizontal properties bar (image elements).
function ImageUpload({
  value,
  onChange,
  buttonLabel,
  hint,
  inline = false,
}: {
  value: string;
  onChange: (url: string) => void; // '' clears
  buttonLabel: string;
  hint?: string;
  inline?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAsset(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => void onPick(e)}
    />
  );

  const hasValue = value.trim() !== '';

  if (inline) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {fileInput}
        {hasValue && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.trim()}
            alt=""
            className="h-8 w-8 rounded-md border border-line object-cover bg-surface-sunken"
          />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors disabled:opacity-60"
        >
          <ImagePlus size={13} strokeWidth={1.75} className="shrink-0" />
          {uploading ? 'Uploading…' : buttonLabel}
        </button>
        {hasValue && !uploading && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            Remove
          </button>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or paste URL"
          aria-label="Image URL"
          className="h-8 w-40 rounded-md border border-line bg-surface-raised px-2 text-xs focus:border-line-strong focus:outline-none"
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div>
      {fileInput}
      {hasValue ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.trim()}
            alt=""
            className="w-full h-20 rounded-md border border-line object-cover bg-surface-sunken"
          />
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={uploading}
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-3 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors disabled:opacity-60"
          >
            <ImagePlus size={14} strokeWidth={1.75} className="shrink-0" />
            {uploading ? 'Uploading…' : buttonLabel}
          </button>
          {!showUrl && (
            <button
              type="button"
              onClick={() => setShowUrl(true)}
              className="mt-1.5 text-xs text-ink-muted hover:text-ink underline underline-offset-2"
            >
              or paste a URL
            </button>
          )}
        </>
      )}
      {showUrl && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… image URL"
          aria-label="Image URL"
          className="mt-1.5 w-full h-8 rounded-md border border-line bg-surface-raised px-2 text-xs focus:border-line-strong focus:outline-none"
        />
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function CertificateBuilder({
  template,
  teams,
  members,
  initialShares,
}: {
  template: CertTemplate;
  teams: TeamOption[];
  members: WorkspaceMember[];
  initialShares: CertShares;
}) {
  const router = useRouter();

  const [name, setName] = useState(template.name);
  const [pageSize, setPageSize] = useState<CertPageSize>(template.page_size);
  const [orientation, setOrientation] = useState<CertOrientation>(template.orientation);
  const [backgroundUrl, setBackgroundUrl] = useState(template.background_url ?? '');
  const [elements, setElements] = useState<CertElement[]>(template.elements ?? []);
  const [scope, setScope] = useState<CertScope>(template.scope);
  const [ownerTeamId, setOwnerTeamId] = useState(
    template.owner_team_id ?? teams[0]?.id ?? '',
  );
  const [shares, setShares] = useState<CertShares>(initialShares);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [archived, setArchived] = useState(!!template.archived_at);

  const canvasRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Latest savable state, for global handlers and the debounced saver.
  const stateRef = useRef({ name, pageSize, orientation, backgroundUrl, elements, scope, ownerTeamId });
  useEffect(() => {
    stateRef.current = { name, pageSize, orientation, backgroundUrl, elements, scope, ownerTeamId };
  });

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const s = stateRef.current;
    setSaveStatus('saving');
    const result = await updateCertificateTemplate(template.id, {
      name: s.name,
      page_size: s.pageSize,
      orientation: s.orientation,
      background_url: s.backgroundUrl.trim() === '' ? null : s.backgroundUrl.trim(),
      elements: s.elements,
      scope: s.scope,
      owner_team_id: s.scope === 'team' ? s.ownerTeamId || null : null,
    });
    if (result.ok) {
      setSaveStatus('saved');
      idleTimer.current = setTimeout(() => setSaveStatus('idle'), 2000);
    } else {
      setSaveStatus('error');
    }
  }, [template.id]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void doSave(), 2000);
  }, [doSave]);

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    },
    [],
  );

  const selectedEl = elements.find((e) => e.id === selectedId) ?? null;

  // ── Global drag handlers ─────────────────────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      const drag = draggingRef.current;
      if (!drag || !canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const dx = ((e.clientX - drag.startX) / rect.width) * 100;
      const dy = ((e.clientY - drag.startY) / rect.height) * 100;
      const x = Math.max(0, Math.min(95, drag.origX + dx));
      const y = Math.max(0, Math.min(95, drag.origY + dy));
      setElements((prev) => prev.map((el) => (el.id === drag.id ? { ...el, x, y } : el)));
    }
    function onUp() {
      if (!draggingRef.current) return;
      draggingRef.current = null;
      scheduleSave();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [scheduleSave]);

  // ── Mutators ─────────────────────────────────────────────────────────

  function updateElements(next: CertElement[]) {
    setElements(next);
    scheduleSave();
  }

  function addElement(el: CertElement, startEditing = false) {
    updateElements([...elements, el]);
    setSelectedId(el.id);
    if (startEditing) setEditingId(el.id);
  }

  function addField(field: CertField) {
    addElement({
      id: generateElementId(),
      type: 'field',
      field,
      x: 10,
      y: 10,
      width: 60,
      fontSize: 24,
      fontFamily: 'inherit',
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: INK_DEFAULT,
      textAlign: 'left',
      opacity: 100,
    });
  }

  function addText() {
    addElement(
      {
        id: generateElementId(),
        type: 'text',
        content: 'Text',
        x: 10,
        y: 20,
        width: 50,
        fontSize: 16,
        fontFamily: 'inherit',
        fontWeight: 'normal',
        fontStyle: 'normal',
        color: INK_DEFAULT,
        textAlign: 'left',
        opacity: 100,
      },
      true,
    );
  }

  function addLine() {
    addElement({
      id: generateElementId(),
      type: 'line',
      x: 10,
      y: 50,
      width: 40,
      color: INK_DEFAULT,
      opacity: 100,
    });
  }

  function addImage() {
    addElement({
      id: generateElementId(),
      type: 'image',
      src: '',
      x: 10,
      y: 10,
      width: 30,
      opacity: 100,
    });
  }

  function updateEl(patch: Partial<CertElement>) {
    if (!selectedId) return;
    updateElements(elements.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  }

  // Delete / Backspace removes the selected element — unless the caret is in
  // a field, where those keys mean what they always mean.
  useEffect(() => {
    function onKey(ev: KeyboardEvent) {
      if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
      if (!selectedId || editingId) return;
      const t = ev.target as HTMLElement | null;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
      ev.preventDefault();
      deleteSelected();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  function deleteSelected() {
    if (!selectedId) return;
    updateElements(elements.filter((el) => el.id !== selectedId));
    setSelectedId(null);
    setEditingId(null);
  }

  function reorderSelected(action: 'to-back' | 'backward' | 'forward' | 'to-front') {
    if (!selectedId) return;
    const idx = elements.findIndex((e) => e.id === selectedId);
    if (idx < 0) return;
    const next = [...elements];
    const [el] = next.splice(idx, 1);
    if (action === 'to-back') next.unshift(el);
    else if (action === 'backward') next.splice(Math.max(0, idx - 1), 0, el);
    else if (action === 'forward') next.splice(Math.min(next.length, idx + 1), 0, el);
    else next.push(el);
    updateElements(next);
  }

  // ── Canvas interactions ──────────────────────────────────────────────

  function onElementMouseDown(e: React.MouseEvent, id: string) {
    if (editingId === id) return; // don't drag while editing
    e.preventDefault();
    e.stopPropagation();
    setSelectedId(id);
    const el = elements.find((el) => el.id === id);
    if (!el) return;
    draggingRef.current = { id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
  }

  function onElementDoubleClick(e: React.MouseEvent, el: CertElement) {
    if (el.type !== 'text') return; // fields render their sample value; nothing to edit
    e.preventDefault();
    e.stopPropagation();
    draggingRef.current = null;
    setSelectedId(el.id);
    setEditingId(el.id);
  }

  function deselect() {
    setSelectedId(null);
    setEditingId(null);
  }

  async function confirmDelete() {
    setDeletePending(true);
    const result = await deleteCertificateTemplate(template.id);
    if (result.ok) {
      router.push('/certificates');
      return;
    }
    setDeletePending(false);
    setDeleteOpen(false);
    // The API refuses deletion for templates in use — say so, don't just "fail".
    setDeleteError(result.error);
  }

  const aspect = PAGE_ASPECT[pageSize]?.[orientation] ?? PAGE_ASPECT.a4.portrait;

  const saveStatusLabel =
    saveStatus === 'saving'
      ? 'Saving…'
      : saveStatus === 'saved'
        ? 'Saved'
        : saveStatus === 'error'
          ? 'Save failed'
          : null;

  return (
    <div>
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/certificates"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-subtle hover:text-ink hover:bg-surface-sunken shrink-0"
          title="All templates"
        >
          <ChevronLeft size={18} strokeWidth={1.75} />
        </Link>

        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            scheduleSave();
          }}
          placeholder="Template name"
          aria-label="Template name"
          className={`${CONTROL} w-52 font-medium placeholder:text-ink-muted`}
        />

        <select
          value={pageSize}
          onChange={(e) => {
            setPageSize(e.target.value as CertPageSize);
            scheduleSave();
          }}
          aria-label="Page size"
          className={CONTROL}
        >
          <option value="a4">A4</option>
          <option value="letter">Letter</option>
        </select>

        <div className="flex h-9 rounded-md border border-line overflow-hidden">
          {(['portrait', 'landscape'] as const).map((ori) => (
            <button
              key={ori}
              type="button"
              onClick={() => {
                setOrientation(ori);
                scheduleSave();
              }}
              className={`px-3 text-sm capitalize transition-colors ${
                orientation === ori
                  ? 'bg-ink text-ink-inverse'
                  : 'text-ink-subtle hover:bg-surface-sunken'
              }`}
            >
              {ori}
            </button>
          ))}
        </div>

        <select
          value={scope}
          onChange={(e) => {
            const next = e.target.value as CertScope;
            setScope(next);
            if (next === 'team' && !ownerTeamId && teams[0]) setOwnerTeamId(teams[0].id);
            scheduleSave();
          }}
          aria-label="Scope"
          className={CONTROL}
        >
          <option value="personal">Personal</option>
          {teams.length > 0 && <option value="team">Team</option>}
          <option value="workspace">Workspace</option>
        </select>

        {scope === 'team' && (
          <select
            value={ownerTeamId}
            onChange={(e) => {
              setOwnerTeamId(e.target.value);
              scheduleSave();
            }}
            aria-label="Owning team"
            className={CONTROL}
          >
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}

        {scope === 'workspace' && (
          <Button
            variant="secondary"
            size="sm"
            leading={<Share2 size={14} strokeWidth={1.75} />}
            onClick={() => setShareOpen(true)}
          >
            Share…
          </Button>
        )}

        <div className="flex-1" />

        {deleteError && <span className="text-xs text-red-600">{deleteError}</span>}
        {archived && !deleteError && (
          <span className="text-xs px-2 py-0.5 rounded-full ring-1 ring-line bg-surface-sunken text-ink-muted">
            Archived
          </span>
        )}
        {saveStatusLabel && (
          <span
            className={`text-xs ${saveStatus === 'error' ? 'text-red-600' : 'text-ink-muted'}`}
          >
            {saveStatusLabel}
          </span>
        )}

        <Button size="sm" onClick={() => void doSave()} disabled={saveStatus === 'saving'}>
          Save
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void archiveCertificateTemplate(template.id, !archived).then((r) => {
              if (r.ok) {
                setArchived(!archived);
                router.refresh();
              }
            })
          }
          title={
            archived
              ? 'Restore — show it in template pickers again'
              : 'Archive — keep issued certificates and thread references, hide from pickers'
          }
        >
          <Archive size={15} strokeWidth={1.75} />
          {archived ? 'Restore' : 'Archive'}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDeleteOpen(true)}
          title="Delete template (templates in use can only be archived)"
          aria-label="Delete template"
        >
          <Trash2 size={16} strokeWidth={1.75} />
        </Button>
      </div>

      {/* ── Properties bar (above the canvas) ───────────────────────── */}
      {selectedEl ? (
        // Fixed height + horizontal scroll: selecting an element must never
        // shift the canvas below (Sjoerd 2026-07-02).
        <div className="mt-4 h-[54px] rounded-lg border border-line bg-surface-raised px-4 flex flex-nowrap items-center gap-x-5 overflow-x-auto overflow-y-hidden">
          {selectedEl.type !== 'line' && selectedEl.type !== 'image' && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-subtle whitespace-nowrap">Font</span>
                <select
                  value={selectedEl.fontFamily ?? 'inherit'}
                  onChange={(e) => updateEl({ fontFamily: e.target.value })}
                  className="h-8 rounded-md border border-line bg-surface-raised px-2 text-xs focus:border-line-strong focus:outline-none"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-subtle whitespace-nowrap">Size</span>
                <input
                  type="range"
                  min={8}
                  max={96}
                  value={selectedEl.fontSize ?? 16}
                  onChange={(e) => updateEl({ fontSize: Number(e.target.value) })}
                  className="w-20 accent-ink"
                />
                <input
                  type="number"
                  min={8}
                  max={96}
                  value={selectedEl.fontSize ?? 16}
                  onChange={(e) =>
                    updateEl({ fontSize: Math.max(8, Math.min(96, Number(e.target.value))) })
                  }
                  className="w-14 h-8 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-center focus:border-line-strong focus:outline-none"
                />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-subtle whitespace-nowrap">
              {selectedEl.type === 'image' ? 'Scale' : 'Width'}
            </span>
            <input
              type="range"
              min={5}
              max={100}
              value={selectedEl.width}
              onChange={(e) => updateEl({ width: Number(e.target.value) })}
              className="w-20 accent-ink"
            />
            <input
              type="number"
              min={5}
              max={100}
              value={Math.round(selectedEl.width)}
              onChange={(e) =>
                updateEl({ width: Math.max(5, Math.min(100, Number(e.target.value))) })
              }
              className="w-14 h-8 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-center focus:border-line-strong focus:outline-none"
            />
            <span className="text-xs text-ink-muted">%</span>
          </div>

          {selectedEl.type !== 'line' && selectedEl.type !== 'image' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="Bold"
                onClick={() =>
                  updateEl({
                    fontWeight: selectedEl.fontWeight === 'bold' ? 'normal' : 'bold',
                  })
                }
                className={toggleCls(selectedEl.fontWeight === 'bold')}
              >
                <Bold size={14} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                title="Italic"
                onClick={() =>
                  updateEl({
                    fontStyle: selectedEl.fontStyle === 'italic' ? 'normal' : 'italic',
                  })
                }
                className={toggleCls(selectedEl.fontStyle === 'italic')}
              >
                <Italic size={14} strokeWidth={2} />
              </button>
              {(
                [
                  ['left', AlignLeft],
                  ['center', AlignCenter],
                  ['right', AlignRight],
                ] as const
              ).map(([align, Icon]) => (
                <button
                  key={align}
                  type="button"
                  title={`Align ${align}`}
                  onClick={() => updateEl({ textAlign: align })}
                  className={toggleCls((selectedEl.textAlign ?? 'left') === align)}
                >
                  <Icon size={14} strokeWidth={1.75} />
                </button>
              ))}
            </div>
          )}

          {selectedEl.type !== 'image' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink-subtle">Colour</span>
              <input
                type="color"
                value={selectedEl.color ?? INK_DEFAULT}
                onChange={(e) => updateEl({ color: e.target.value })}
                className="h-8 w-8 rounded-md border border-line cursor-pointer bg-surface-raised p-0.5"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-subtle whitespace-nowrap">Opacity</span>
            <input
              type="range"
              min={0}
              max={100}
              value={selectedEl.opacity ?? 100}
              onChange={(e) => updateEl({ opacity: Number(e.target.value) })}
              className="w-16 accent-ink"
            />
            <span className="text-xs text-ink-muted w-9 tabular-nums">
              {selectedEl.opacity ?? 100}%
            </span>
          </div>

          {selectedEl.type === 'image' && (
            <ImageUpload
              inline
              value={selectedEl.src ?? ''}
              onChange={(url) => updateEl({ src: url })}
              buttonLabel="Upload image"
            />
          )}

          {selectedEl.type === 'text' && editingId !== selectedEl.id && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-ink-muted italic whitespace-nowrap">
                Double-click to edit · insert
              </span>
              {/* Every token, not just one example. They all worked already —
                  substituteFields has since the builder shipped — but the bar
                  named one, so the other eight were invisible (Sjoerd
                  2026-08-31 asking for {start_date}). Clicking appends it to
                  the text. */}
              <select
                value=""
                onChange={(ev) => {
                  const token = ev.target.value;
                  if (!token) return;
                  const cur = selectedEl.content ?? '';
                  updateEl({ content: cur ? `${cur} {${token}}` : `{${token}}` });
                  ev.target.value = '';
                }}
                className="h-7 rounded-md border border-line bg-surface px-1.5 text-xs outline-none focus:border-ink"
                title="Insert a token — it becomes the real value on the issued certificate"
              >
                <option value="">token…</option>
                {FIELD_OPTIONS.map((f) => (
                  <option key={f.field} value={f.field}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Remove the selected element. deleteSelected() existed from the
              start but nothing ever called it, so there was no way to take
              anything off the canvas (Sjoerd 2026-08-31). Delete/Backspace
              works too, handled on the canvas. */}
          <button
            type="button"
            onClick={deleteSelected}
            title="Remove this element (Delete)"
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 h-7 text-xs text-ink-subtle hover:text-red-700 hover:bg-surface-sunken"
          >
            <Trash2 size={14} strokeWidth={1.75} />
            Remove
          </button>

          <div className="flex items-center gap-1">
            <span className="text-xs text-ink-subtle whitespace-nowrap">Arrange</span>
            <button
              type="button"
              title="Send to back"
              onClick={() => reorderSelected('to-back')}
              className={toggleCls(false)}
            >
              <ChevronsDown size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              title="Move backward"
              onClick={() => reorderSelected('backward')}
              className={toggleCls(false)}
            >
              <ChevronDown size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              title="Move forward"
              onClick={() => reorderSelected('forward')}
              className={toggleCls(false)}
            >
              <ChevronUp size={14} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              title="Bring to front"
              onClick={() => reorderSelected('to-front')}
              className={toggleCls(false)}
            >
              <ChevronsUp size={14} strokeWidth={1.75} />
            </button>
          </div>

          <div className="ml-auto">
            <Button variant="danger" size="sm" onClick={deleteSelected}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 h-[54px] rounded-lg border border-dashed border-line px-4 flex items-center">
          <span className="text-xs text-ink-muted">Select an element to edit its style</span>
        </div>
      )}

      {/* ── Main area ───────────────────────────────────────────────── */}
      <div className="mt-6 flex items-start gap-6">
        {/* Left panel */}
        <div className="w-[260px] shrink-0 space-y-6">
          <div>
            <SectionLabel>Fields</SectionLabel>
            <div className="mt-2 space-y-1">
              {FIELD_OPTIONS.map(({ field, label }) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => addField(field)}
                  className="w-full flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors text-left"
                >
                  <Plus size={12} strokeWidth={2} className="shrink-0" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <SectionLabel>Elements</SectionLabel>
            <div className="mt-2 space-y-1">
              <button
                type="button"
                onClick={addText}
                className="w-full flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors text-left"
              >
                <Type size={12} strokeWidth={2} className="shrink-0" />
                Text
              </button>
              <button
                type="button"
                onClick={addLine}
                className="w-full flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors text-left"
              >
                <Minus size={12} strokeWidth={2} className="shrink-0" />
                Line
              </button>
              <button
                type="button"
                onClick={addImage}
                className="w-full flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors text-left"
              >
                <ImageIcon size={12} strokeWidth={2} className="shrink-0" />
                Image
              </button>
            </div>
          </div>

          <div>
            <SectionLabel>Background</SectionLabel>
            <div className="mt-2">
              <ImageUpload
                value={backgroundUrl}
                onChange={(url) => {
                  setBackgroundUrl(url);
                  scheduleSave();
                }}
                buttonLabel="Upload background"
                hint="Fills the page as a cover background."
              />
            </div>
          </div>
        </div>

        {/* Canvas + properties */}
        <div className="flex-1 min-w-0">
          <div className="flex justify-center">
            <div className="relative w-full max-w-[700px] shadow-lg">
              {/* Centre guides */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div
                  className="absolute left-1/2 top-0 bottom-0 border-l border-dashed"
                  style={{ borderColor: GUIDE }}
                />
                <div
                  className="absolute top-1/2 left-0 right-0 border-t border-dashed"
                  style={{ borderColor: GUIDE }}
                />
              </div>

              <div
                ref={canvasRef}
                className="relative w-full overflow-hidden bg-white select-none rounded-sm ring-1 ring-line"
                style={{
                  paddingBottom: `${(1 / aspect) * 100}%`,
                  backgroundImage: backgroundUrl.trim() ? `url(${backgroundUrl.trim()})` : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
                onClick={(e) => {
                  if (e.target === canvasRef.current) deselect();
                }}
              >
                {/* Light grid when there is no background */}
                {!backgroundUrl.trim() && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        'linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)',
                      backgroundSize: '5% 5%',
                    }}
                  />
                )}

                {elements.map((el) => {
                  const isSelected = el.id === selectedId;
                  const isEditing = el.id === editingId;
                  const outline = isSelected ? `2px solid ${ACCENT}` : 'none';

                  if (el.type === 'line') {
                    return (
                      <div
                        key={el.id}
                        className="absolute"
                        style={{
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          width: `${el.width}%`,
                          height: 2,
                          background: el.color ?? INK_DEFAULT,
                          opacity: el.opacity !== undefined ? el.opacity / 100 : 1,
                          outline,
                          outlineOffset: '2px',
                          cursor: 'move',
                        }}
                        onMouseDown={(e) => onElementMouseDown(e, el.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    );
                  }

                  if (el.type === 'image') {
                    return (
                      <div
                        key={el.id}
                        className="absolute"
                        style={{
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          width: `${el.width}%`,
                          opacity: el.opacity !== undefined ? el.opacity / 100 : 1,
                          outline,
                          outlineOffset: '2px',
                          cursor: 'move',
                        }}
                        onMouseDown={(e) => onElementMouseDown(e, el.id)}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {el.src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={el.src}
                            alt=""
                            className="w-full h-auto block pointer-events-none"
                            draggable={false}
                          />
                        ) : (
                          <div className="w-full h-12 bg-black/[0.03] border border-dashed border-black/20 flex items-center justify-center text-[10px] text-black/40 pointer-events-none">
                            Select, then upload an image
                          </div>
                        )}
                      </div>
                    );
                  }

                  // field / text
                  return (
                    <div
                      key={el.id}
                      className="absolute"
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.width}%`,
                        outline: isEditing ? `2px solid ${ACCENT}` : outline,
                        outlineOffset: '2px',
                        cursor: isEditing ? 'text' : 'move',
                        minHeight: '1em',
                      }}
                      onMouseDown={(e) => onElementMouseDown(e, el.id)}
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => onElementDoubleClick(e, el)}
                    >
                      {isEditing && el.type === 'text' ? (
                        <textarea
                          autoFocus
                          value={el.content ?? ''}
                          onChange={(e) => updateEl({ content: e.target.value })}
                          onBlur={() => setEditingId(null)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') setEditingId(null);
                            e.stopPropagation();
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full bg-transparent resize-none focus:outline-none border-none p-0 m-0"
                          style={{
                            ...elFontStyle(el),
                            opacity: 1,
                            display: 'block',
                            minHeight: '1.5em',
                            overflow: 'hidden',
                          }}
                          rows={3}
                        />
                      ) : (
                        <div className="whitespace-pre-wrap break-words" style={elFontStyle(el)}>
                          {resolveDisplay(el)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────── */}
      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        templateId={template.id}
        members={members}
        teams={teams}
        shares={shares}
        onSaved={setShares}
      />

      <ConfirmDialog
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void confirmDelete()}
        title="Delete template"
        message={`Delete “${name || 'this template'}”? Threads that reference it will lose their certificate design.`}
        confirmLabel="Delete"
        destructive
        pending={deletePending}
      />
    </div>
  );
}
