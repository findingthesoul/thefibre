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
  QrCode,
  Trash2,
  X,
  Type,
} from 'lucide-react';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SectionLabel } from '@/components/ui/page';
import { uploadAsset } from '@/lib/upload';
import type { TeamOption, WorkspaceMember } from '@/lib/thread-types';
import {
  ANCHOR_GRID,
  FIELD_OPTIONS,
  FONT_OPTIONS,
  MM_PER_PX,
  SAMPLE_VALUES,
  anchorToTopLeft,
  offsetFromAnchor,
  pageMm,
  PAGE_ASPECT,
  elFontStyle,
  generateElementId,
  resolveDisplay,
  type CertAnchor,
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
  // Position tool: which page corner positions are measured from, and in
  // what unit. Both are workspace-of-the-moment preferences, not template
  // data — the stored geometry stays percentages.
  const [anchor, setAnchor] = useState<CertAnchor>('top-left');
  const [unit, setUnit] = useState<'mm' | 'px'>('mm');
  // The selected element's rendered size as a % of the page. Width is known
  // from the model; HEIGHT is content-driven, so it is measured — without it
  // the bottom and middle anchors would be guesses.
  const elBoxRef = useRef<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
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

  /** A QR of the certificate's own verification page. It carries no content:
   *  the number only exists once a certificate is issued, so the builder shows
   *  a placeholder and the real code is generated per certificate. */
  function addQr() {
    addElement({
      id: generateElementId(),
      type: 'qr',
      x: 78,
      y: 72,
      width: 14,
      opacity: 100,
    });
  }

  function updateEl(patch: Partial<CertElement>) {
    if (!selectedId) return;
    updateElements(elements.map((el) => (el.id === selectedId ? { ...el, ...patch } : el)));
  }

  // Measure the selected element after every render that could change its
  // size — the model knows its width, only the DOM knows how tall the text
  // wrapped.
  useEffect(() => {
    const node = elBoxRef.current;
    const canvas = canvasRef.current;
    if (!node || !canvas) {
      setMeasured({ w: 0, h: 0 });
      return;
    }
    const c = canvas.getBoundingClientRect();
    const r = node.getBoundingClientRect();
    if (!c.width || !c.height) return;
    const next = { w: (r.width / c.width) * 100, h: (r.height / c.height) * 100 };
    setMeasured((prev) =>
      Math.abs(prev.w - next.w) < 0.01 && Math.abs(prev.h - next.h) < 0.01 ? prev : next,
    );
  });

  const page = pageMm(pageSize, orientation);

  /** Page-percent → the display unit. */
  function toUnit(pct: number, axis: 'x' | 'y'): number {
    const mm = (pct / 100) * (axis === 'x' ? page.w : page.h);
    return unit === 'mm' ? mm : mm / MM_PER_PX;
  }
  /** The display unit → page-percent. */
  function fromUnit(value: number, axis: 'x' | 'y'): number {
    const mm = unit === 'mm' ? value : value * MM_PER_PX;
    return (mm / (axis === 'x' ? page.w : page.h)) * 100;
  }
  const round1 = (n: number) => Math.round(n * 10) / 10;

  /** Move the selected element so its anchor offset becomes `value`. */
  function setOffset(axis: 'x' | 'y', value: number) {
    if (!selectedEl) return;
    const size = { w: selectedEl.width, h: measured.h };
    const cur = offsetFromAnchor(anchor, {
      x: selectedEl.x,
      y: selectedEl.y,
      w: size.w,
      h: size.h,
    });
    const next = { ...cur, [axis]: fromUnit(value, axis) };
    const pos = anchorToTopLeft(anchor, next, size);
    updateEl({ x: round1(Math.max(-50, Math.min(150, pos.x))), y: round1(Math.max(-50, Math.min(150, pos.y))) });
  }

  /** The remove handle: a dot on the selected element's corner, the way
   *  every design tool does it. It replaced a Delete button in the toolbar,
   *  which sat far from the thing it deleted and read as misplaced (Sjoerd
   *  2026-08-31). Delete/Backspace still works. */
  function RemoveHandle() {
    return (
      <button
        type="button"
        title="Remove this element (or press Delete)"
        aria-label="Remove this element"
        onMouseDown={(ev) => ev.stopPropagation()}
        onClick={(ev) => {
          ev.stopPropagation();
          deleteSelected();
        }}
        className="absolute -right-2.5 -top-2.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white shadow-sm ring-2 ring-white hover:bg-red-600"
      >
        <X size={11} strokeWidth={3} />
      </button>
    );
  }

  /** Grow a textarea to fit its content — see the editing textarea below. */
  function autoGrow(node: HTMLTextAreaElement | null) {
    if (!node) return;
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
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

      {/* ── Properties bar (above the canvas) ───────────────────────────
          Sticky: an A4 canvas is taller than the viewport, so styling an
          element near the bottom of the page meant scrolling to it and
          leaving every control behind (Sjoerd 2026-08-31). It now follows
          down the page. The opaque background matters — the canvas scrolls
          underneath it. */}
      <div className="sticky top-0 z-20 -mt-1 bg-surface pt-1 pb-2">
      {selectedEl ? (
        // Fixed height + horizontal scroll: selecting an element must never
        // shift the canvas below (Sjoerd 2026-07-02).
        <div className="mt-4 flex items-stretch gap-3">
        <div className="h-[54px] min-w-0 flex-1 rounded-lg border border-line bg-surface-raised px-4 flex flex-nowrap items-center gap-x-5 overflow-x-auto overflow-y-hidden">
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

              {/* Size in POINTS — what type is set in everywhere else
                  (Sjoerd 2026-08-31). Stored as px, converted for display:
                  1pt = 96/72 px, so existing designs keep their size. */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-subtle whitespace-nowrap">Size</span>
                <input
                  type="range"
                  min={6}
                  max={72}
                  value={Math.round((selectedEl.fontSize ?? 16) * 0.75)}
                  onChange={(e) => updateEl({ fontSize: Number(e.target.value) / 0.75 })}
                  className="w-20 accent-ink"
                />
                <input
                  type="number"
                  min={6}
                  max={72}
                  step={0.5}
                  value={Math.round((selectedEl.fontSize ?? 16) * 0.75 * 10) / 10}
                  onChange={(e) =>
                    updateEl({
                      fontSize: Math.max(6, Math.min(72, Number(e.target.value))) / 0.75,
                    })
                  }
                  className="w-14 h-8 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-center focus:border-line-strong focus:outline-none"
                />
                <span className="text-xs text-ink-muted">pt</span>
              </div>
            </>
          )}

          {/* Position — Illustrator's reference point, applied to the PAGE:
              pick which corner/edge the numbers are measured from, then type
              them. Positive always points inward, so "10mm from the right"
              reads the same whichever corner you chose (Sjoerd 2026-08-31).
              The element's own matching edge is measured; its height is taken
              from the DOM because text height is content-driven. */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-subtle whitespace-nowrap">Position</span>
            <div
              className="grid grid-cols-3 gap-px rounded border border-line p-px"
              title="Measure from this point of the page"
            >
              {ANCHOR_GRID.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-label={a.replace('-', ' ')}
                  title={a.replace('-', ' ')}
                  onClick={() => setAnchor(a)}
                  className={`h-[7px] w-[7px] rounded-[1px] ${
                    anchor === a ? 'bg-ink' : 'bg-line hover:bg-ink-muted'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-ink-muted">X</span>
            <input
              type="number"
              step={unit === 'mm' ? 0.5 : 1}
              value={round1(
                toUnit(
                  offsetFromAnchor(anchor, {
                    x: selectedEl.x,
                    y: selectedEl.y,
                    w: selectedEl.width,
                    h: measured.h,
                  }).x,
                  'x',
                ),
              )}
              onChange={(e) => setOffset('x', Number(e.target.value))}
              className="w-16 h-8 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-center focus:border-line-strong focus:outline-none"
            />
            <span className="text-xs text-ink-muted">Y</span>
            <input
              type="number"
              step={unit === 'mm' ? 0.5 : 1}
              value={round1(
                toUnit(
                  offsetFromAnchor(anchor, {
                    x: selectedEl.x,
                    y: selectedEl.y,
                    w: selectedEl.width,
                    h: measured.h,
                  }).y,
                  'y',
                ),
              )}
              onChange={(e) => setOffset('y', Number(e.target.value))}
              className="w-16 h-8 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-center focus:border-line-strong focus:outline-none"
            />
            <div className="flex rounded-md border border-line overflow-hidden h-8">
              {(['mm', 'px'] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  className={`px-1.5 text-[11px] ${
                    unit === u ? 'bg-surface-sunken text-ink font-medium' : 'text-ink-subtle'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

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
            {/* Typed in the position tool's unit, not just dragged. */}
            <input
              type="number"
              min={0}
              step={unit === 'mm' ? 0.5 : 1}
              value={round1(toUnit(selectedEl.width, 'x'))}
              onChange={(e) =>
                updateEl({
                  width: Math.max(1, Math.min(100, fromUnit(Number(e.target.value), 'x'))),
                })
              }
              className="w-16 h-8 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-center focus:border-line-strong focus:outline-none"
            />
            <span className="text-xs text-ink-muted">{unit}</span>
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
            <input
              type="number"
              min={0}
              max={100}
              value={selectedEl.opacity ?? 100}
              onChange={(e) =>
                updateEl({ opacity: Math.max(0, Math.min(100, Number(e.target.value))) })
              }
              className="w-14 h-8 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-center focus:border-line-strong focus:outline-none"
            />
            <span className="text-xs text-ink-muted">%</span>
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

        </div>
        </div>
      ) : (
        <div className="mt-4 h-[54px] rounded-lg border border-dashed border-line px-4 flex items-center">
          <span className="text-xs text-ink-muted">Select an element to edit its style</span>
        </div>
      )}
      </div>

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

          {/* Every token, on screen. The dropdown in the properties bar can
              insert them, but only while a text element is selected — and a
              list you can read beats a list you must go looking for (Sjoerd
              2026-08-31). Shows the literal token, what it means, and what it
              becomes. Click to insert into the selected text element. */}
          <div>
            <SectionLabel>Tokens</SectionLabel>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">
              Type these into any text element — they become the real value on
              each issued certificate.
            </p>
            <ul className="mt-2 space-y-1">
              {FIELD_OPTIONS.map(({ field, label }) => {
                const insertable = selectedEl?.type === 'text';
                return (
                  <li key={field}>
                    <button
                      type="button"
                      disabled={!insertable}
                      title={
                        insertable
                          ? `Insert {${field}} into the selected text`
                          : 'Select a text element to insert this'
                      }
                      onClick={() => {
                        const cur = selectedEl?.content ?? '';
                        updateEl({ content: cur ? `${cur} {${field}}` : `{${field}}` });
                      }}
                      className="w-full rounded-md border border-line px-2.5 py-1.5 text-left transition-colors enabled:hover:border-line-strong enabled:hover:bg-surface-sunken disabled:cursor-default"
                    >
                      <span className="block font-mono text-[11px] text-ink">{`{${field}}`}</span>
                      <span className="block text-[11px] text-ink-subtle">
                        {label} · <span className="italic">{SAMPLE_VALUES[field] ?? ''}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
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
              <button
                type="button"
                onClick={addQr}
                title="A QR code linking to this certificate's own verification page"
                className="w-full flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-1.5 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors text-left"
              >
                <QrCode size={12} strokeWidth={2} className="shrink-0" />
                QR code
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
                        ref={isSelected ? elBoxRef : undefined}
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
                      >
                        {isSelected && <RemoveHandle />}
                      </div>
                    );
                  }

                  if (el.type === 'image') {
                    return (
                      <div
                        key={el.id}
                        ref={isSelected ? elBoxRef : undefined}
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
                        {isSelected && <RemoveHandle />}
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

                  if (el.type === 'qr') {
                    return (
                      <div
                        key={el.id}
                        ref={isSelected ? elBoxRef : undefined}
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
                        {isSelected && <RemoveHandle />}
                        {/* A placeholder: the real code encodes the issued
                            certificate's number, which does not exist yet. */}
                        <div
                          className="aspect-square w-full border border-black/20 bg-white p-[6%] pointer-events-none"
                          style={{
                            backgroundImage:
                              'repeating-conic-gradient(#111 0% 25%, #fff 0% 50%)',
                            backgroundSize: '18% 18%',
                          }}
                        />
                        <div className="mt-0.5 text-center text-[7px] leading-none text-black/50 pointer-events-none">
                          QR · verification page
                        </div>
                      </div>
                    );
                  }

                  // field / text
                  return (
                    <div
                      key={el.id}
                      ref={isSelected ? elBoxRef : undefined}
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
                      {isSelected && !isEditing && <RemoveHandle />}
                      {isEditing && el.type === 'text' ? (
                        <textarea
                          autoFocus
                          value={el.content ?? ''}
                          // Grow with the text. rows={3} + overflow:hidden
                          // meant a longer text SHRANK to three lines the
                          // moment you double-clicked into it, and everything
                          // typed past that was clipped out of sight (Sjoerd
                          // 2026-08-31). The box now matches its content, so
                          // editing looks like the certificate does.
                          ref={autoGrow}
                          onChange={(e) => {
                            autoGrow(e.currentTarget);
                            updateEl({ content: e.target.value });
                          }}
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
                          rows={1}
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
