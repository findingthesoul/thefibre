// Certificate template document — ported from thethread-v3's cert-builder.
// The API stores the whole design as a JSON `elements` array on the
// certificate_template row; the builder and the public renderer share
// these shapes and helpers.

import type { CSSProperties } from 'react';

export type CertScope = 'personal' | 'team' | 'workspace';
export type CertPageSize = 'a4' | 'letter';
export type CertOrientation = 'portrait' | 'landscape';

export type CertField =
  | 'recipient_name'
  | 'thread_title'
  | 'org_name'
  | 'issue_date'
  | 'start_date'
  | 'end_date'
  | 'certificate_number'
  | 'criteria'
  | 'issued_by';

export type CertElement = {
  id: string;
  type: 'field' | 'text' | 'image' | 'line';
  field?: CertField;
  content?: string; // text type; supports {token} substitution
  src?: string; // image type (URL)
  x: number; // 0-100, % from left
  y: number; // 0-100, % from top
  width: number; // % of page width
  fontSize?: number; // px (8-96)
  fontFamily?: string;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: number; // 0-100
};

export type CertTemplate = {
  id: string;
  name: string;
  scope: CertScope;
  owner_user_id: string | null;
  owner_team_id: string | null;
  page_size: CertPageSize;
  orientation: CertOrientation;
  background_url: string | null;
  elements: CertElement[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CertShares = { user_ids: string[]; team_ids: string[] };

// ── Field tokens ─────────────────────────────────────────────────────────

export const FIELD_OPTIONS: { field: CertField; label: string }[] = [
  { field: 'recipient_name', label: 'Recipient name' },
  { field: 'thread_title', label: 'Thread title' },
  { field: 'org_name', label: 'Organisation' },
  { field: 'issue_date', label: 'Issue date' },
  { field: 'start_date', label: 'Start date' },
  { field: 'end_date', label: 'End date' },
  { field: 'certificate_number', label: 'Certificate number' },
  { field: 'criteria', label: 'Criteria / awarded for' },
  { field: 'issued_by', label: 'Issued by' },
];

// Sample values shown on the builder canvas so the design reads as a real
// certificate rather than a grid of token names.
export const SAMPLE_VALUES: Record<string, string> = {
  recipient_name: 'Marja Koski',
  thread_title: 'Vertrouwen als de basis',
  org_name: 'Solidarity Lab',
  issue_date: '2 July 2026',
  start_date: '8 Aug 2026',
  end_date: '12 Aug 2026',
  certificate_number: 'THR-2026-AB12C',
  criteria: 'Completed all sessions',
  issued_by: 'Sjoerd Luteijn',
};

// ── Page geometry ────────────────────────────────────────────────────────

export const PAGE_ASPECT: Record<CertPageSize, Record<CertOrientation, number>> = {
  a4: { portrait: 1 / 1.4142, landscape: 1.4142 },
  letter: { portrait: 1 / 1.2941, landscape: 1.2941 },
};

export const PAGE_SIZE_LABELS: Record<CertPageSize, string> = {
  a4: 'A4',
  letter: 'Letter',
};

// ── Typography ───────────────────────────────────────────────────────────

export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: 'Inherit', value: 'inherit' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Times New Roman', value: '"Times New Roman", serif' },
  { label: 'Palatino', value: '"Palatino Linotype", Palatino, serif' },
  { label: 'Garamond', value: 'Garamond, serif' },
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Helvetica', value: 'Helvetica, Arial, sans-serif' },
  { label: 'Verdana', value: 'Verdana, sans-serif' },
  { label: 'Courier New', value: '"Courier New", monospace' },
];

// ── Helpers ──────────────────────────────────────────────────────────────

export function generateElementId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Replace {token} occurrences in text content with concrete values. */
export function substituteFields(content: string, values: Record<string, string>): string {
  return content.replace(/\{(\w+)\}/g, (m, k: string) => values[k] ?? m);
}

/** What an element shows on the builder canvas (sample values). */
export function resolveDisplay(el: CertElement, values: Record<string, string> = SAMPLE_VALUES): string {
  if (el.type === 'field' && el.field) return values[el.field] ?? `{${el.field}}`;
  if (el.type === 'text') return substituteFields(el.content ?? '', values);
  return '';
}

/** Inline font/appearance style for a text-like element. */
export function elFontStyle(el: CertElement): CSSProperties {
  return {
    fontSize: `${el.fontSize ?? 16}px`,
    fontFamily: el.fontFamily && el.fontFamily !== 'inherit' ? el.fontFamily : undefined,
    fontWeight: el.fontWeight ?? 'normal',
    fontStyle: el.fontStyle ?? 'normal',
    color: el.color ?? '#1a1a2e',
    textAlign: el.textAlign ?? 'left',
    opacity: el.opacity !== undefined ? el.opacity / 100 : 1,
    lineHeight: 1.35,
  };
}
