// One file from a connected Drive folder, shown inside my.thread (Sjoerd,
// 2026-10-17: "Would be better if it opens a PDF in a screen... and then show
// a download [button]. People may not know what they are looking at."). A PDF
// (or a Google Doc exported as one) shows in the browser's own PDF viewer, an
// image as an image, anything else as its name, type and size. "Open" and
// "Download" both go through this app's download route, which mints a fresh
// one-minute address on the API for every load, so a page left open never
// holds a dead link. What may be shown inline is the API's decision
// (`viewable`); this page only lays it out (lib/drive-view.ts).

import Link from 'next/link';
import { ChevronRight, Download, ExternalLink, FileText } from 'lucide-react';
import { CARD, NOTICE } from '@thefibre/shared/ui/recipes';
import { buttonClassName } from '@thefibre/shared/ui/button';
import { loadFrame } from '@/lib/session';
import { fetchDriveFolder, type DriveError, type DriveItem } from '@/lib/portal-api';
import { typeLabel, viewKind } from '@/lib/drive-view';
import { fmtBytes, fmtDate } from '@/lib/format';
import { pageLocale } from '@/lib/locale';
import { t, type MyKey } from '@/lib/i18n';
import type { Locale } from '@thefibre/shared/i18n';
import { SignedOut } from '../../../../../signed-out';
import { PageShell } from '../../../../../page-shell';

export const dynamic = 'force-dynamic';

const ERROR_KEY: Record<DriveError, MyKey> = {
  not_found: 'drive_not_found',
  not_shared: 'drive_not_shared',
  unavailable: 'drive_unavailable',
  drive_not_configured: 'drive_not_configured',
  failed: 'drive_failed',
};

export default async function DriveFileViewer({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
  searchParams: Promise<{ file?: string; folder?: string }>;
}) {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  const locale = await pageLocale();
  const { workspaceId, documentId } = await params;
  const { file, folder } = await searchParams;
  const here = `/files/drive/${encodeURIComponent(workspaceId)}/${encodeURIComponent(documentId)}`;
  // The file is found in its own folder's listing: the same admission, and
  // the breadcrumbs, type and size come with it.
  const r = await fetchDriveFolder(session.token, workspaceId, documentId, folder ?? null);
  const item = r.ok && file ? r.listing.items.find((i) => i.kind === 'file' && i.id === file) : undefined;

  return (
    <PageShell title={item?.name ?? t(locale, 'nav_files')}>
      <nav className="mt-2 flex flex-wrap items-center gap-1 text-sm text-ink-subtle" aria-label="breadcrumbs">
        <Link href="/files" className="underline underline-offset-2 hover:text-ink">
          {t(locale, 'drive_all_files')}
        </Link>
        {r.ok &&
          r.listing.breadcrumbs.map((b, i) => (
            <span key={b.id} className="inline-flex items-center gap-1">
              <ChevronRight size={14} aria-hidden />
              <Link href={i === 0 ? here : `${here}?folder=${encodeURIComponent(b.id)}`} className="underline underline-offset-2 hover:text-ink">
                {b.name}
              </Link>
            </span>
          ))}
      </nav>

      {!r.ok ? (
        <p className={`mt-6 ${NOTICE.error}`}>{t(locale, ERROR_KEY[r.code])}</p>
      ) : !item ? (
        <p className={`mt-6 ${NOTICE.error}`}>{t(locale, 'drive_not_found')}</p>
      ) : (
        <Viewer item={item} here={here} folder={folder ?? null} maxDownload={r.listing.limits?.max_download_bytes} locale={locale} />
      )}
    </PageShell>
  );
}

function Viewer({ item, here, folder, maxDownload, locale }: { item: DriveItem; here: string; folder: string | null; maxDownload?: number; locale: Locale }) {
  const kind = viewKind(item);
  const q = `file=${encodeURIComponent(item.id)}${folder ? `&folder=${encodeURIComponent(folder)}` : ''}`;
  const downloadHref = `${here}/download?${q}${item.export_as ? '&export=1' : ''}`;
  const inlineHref = `${here}/download?${q}&inline=1`;
  const facts = [typeLabel(item), item.export_as === 'pdf' ? null : fmtBytes(item.bytes, locale), t(locale, 'drive_changed', { date: fmtDate(item.modified_at, locale) ?? '' })]
    .filter(Boolean)
    .join(' · ');

  if (!item.downloadable) {
    const why = item.reason === 'too_large'
      ? (maxDownload ? t(locale, 'drive_too_large_over', { size: fmtBytes(maxDownload, locale) }) : t(locale, 'drive_too_large'))
      : t(locale, 'drive_not_exportable');
    return (
      <div className={`mt-6 ${CARD} p-5`}>
        <p className="text-sm text-ink-muted">{facts}</p>
        <p className="mt-2 text-sm text-ink">{why}</p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {kind !== 'none' && (
          <a href={inlineHref} target="_blank" rel="noopener" className={buttonClassName('secondary', 'md')}>
            <ExternalLink size={16} aria-hidden />
            {t(locale, 'drive_open')}
          </a>
        )}
        <a href={downloadHref} className={buttonClassName('primary', 'md')}>
          <Download size={16} aria-hidden />
          {t(locale, 'drive_download')}
        </a>
        <span className="text-xs text-ink-muted">{facts}</span>
      </div>

      {kind === 'pdf' ? (
        // The browser's own PDF viewer. On a phone it is smaller; "Open"
        // above shows it full screen in a tab of its own.
        <iframe src={inlineHref} title={item.name} className={`h-[60vh] w-full sm:h-[78vh] ${CARD}`} />
      ) : kind === 'image' ? (
        // eslint-disable-next-line @next/next/no-img-element -- a short-lived API address, not an optimisable asset
        <img src={inlineHref} alt={item.name} className={`mx-auto max-h-[78vh] w-auto max-w-full object-contain ${CARD}`} />
      ) : (
        <div className={`${CARD} flex items-start gap-3 p-5`}>
          <FileText size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-subtle" aria-hidden />
          <p className="text-sm text-ink">{t(locale, 'drive_no_preview')}</p>
        </div>
      )}
    </div>
  );
}
