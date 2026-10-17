// How a Drive file opens in my.thread's viewer (Sjoerd, 2026-10-17: "opens a
// PDF in a screen ... and then show a download [button]. People may not know
// what they are looking at."). The API decides what may be shown inline
// (`viewable`, builder 4's rule: application/pdf, a Doc exported as PDF, or
// a png/jpeg/webp/gif); this only chooses the element. Without `viewable`
// (an older API) nothing is shown inline: the viewer still names the file
// and offers Download, exactly what the row did before.

import type { DriveItem } from './portal-api';

export type ViewKind = 'pdf' | 'image' | 'none';

const IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export function viewKind(item: Pick<DriveItem, 'mime' | 'export_as' | 'viewable'>): ViewKind {
  if (item.viewable !== true) return 'none';
  if (item.export_as === 'pdf' || item.mime === 'application/pdf') return 'pdf';
  if (IMAGES.has(item.mime)) return 'image';
  // `viewable` with a type we do not know how to show: say so, don't guess.
  return 'none';
}

/** A short type label for the "no preview" card: the extension, upper-case
 *  ("DOCX"), "PDF" for an export, or null when the name has none. */
export function typeLabel(item: Pick<DriveItem, 'name' | 'export_as'>): string | null {
  if (item.export_as === 'pdf') return 'PDF';
  const m = /\.([a-z0-9]{1,8})$/i.exec(item.name);
  return m ? m[1]!.toUpperCase() : null;
}
