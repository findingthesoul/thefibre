// A connected Google Drive folder, browsed inside my.thread (Sjoerd,
// 2026-10-17: "go Drive folders"). The API (builder 4's routes) decides who
// may see it — the same visibleTo as the community's documents — and lists
// one folder at a time; this page only lays it out. Each folder is its own
// address (?folder=), so the back button, a bookmark and a shared link all
// land on the same folder. A file downloads through this app's own route,
// which hands the browser a one-minute address on the API — never a Drive
// URL, and nothing large passes through here.

import Link from 'next/link';
import { ChevronRight, FileText, Folder } from 'lucide-react';
import { NOTICE, ROW_LIST } from '@thefibre/shared/ui/recipes';
import { loadFrame } from '@/lib/session';
import { fetchDriveFolder, type DriveError, type DriveItem } from '@/lib/portal-api';
import { fmtBytes, fmtDate } from '@/lib/format';
import { pageLocale } from '@/lib/locale';
import { t, type MyKey } from '@/lib/i18n';
import type { Locale } from '@thefibre/shared/i18n';
import { SignedOut } from '../../../../signed-out';
import { PageShell } from '../../../../page-shell';

export const dynamic = 'force-dynamic';

const ERROR_KEY: Record<DriveError, MyKey> = {
  not_found: 'drive_not_found',
  not_shared: 'drive_not_shared',
  unavailable: 'drive_unavailable',
  drive_not_configured: 'drive_not_configured',
  failed: 'drive_failed',
};

/** A download that did not start, by the API's code (download/route.ts). */
const DOWNLOAD_ERROR: Record<string, MyKey> = {
  not_found: 'drive_not_found',
  not_shared: 'drive_not_shared',
  not_exportable: 'drive_not_exportable_long',
  unavailable: 'drive_unavailable',
  drive_not_configured: 'drive_not_configured',
};

export default async function DriveFolderPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string; documentId: string }>;
  searchParams: Promise<{ folder?: string; error?: string }>;
}) {
  const session = await loadFrame();
  if (!session) return <SignedOut />;
  const locale = await pageLocale();
  const { workspaceId, documentId } = await params;
  const { folder, error } = await searchParams;
  const here = `/files/drive/${encodeURIComponent(workspaceId)}/${encodeURIComponent(documentId)}`;
  const r = await fetchDriveFolder(session.token, workspaceId, documentId, folder ?? null);

  return (
    <PageShell title={r.ok ? r.listing.folder.name : t(locale, 'nav_files')}>
      <nav className="mt-2 flex flex-wrap items-center gap-1 text-sm text-ink-subtle" aria-label="breadcrumbs">
        <Link href="/files" className="underline underline-offset-2 hover:text-ink">
          {t(locale, 'drive_all_files')}
        </Link>
        {r.ok &&
          r.listing.breadcrumbs.map((b, i) => {
            const last = i === r.listing.breadcrumbs.length - 1;
            return (
              <span key={b.id} className="inline-flex items-center gap-1">
                <ChevronRight size={14} aria-hidden />
                {last ? (
                  <span className="text-ink" aria-current="page">{b.name}</span>
                ) : (
                  <Link href={i === 0 ? here : `${here}?folder=${encodeURIComponent(b.id)}`} className="underline underline-offset-2 hover:text-ink">
                    {b.name}
                  </Link>
                )}
              </span>
            );
          })}
      </nav>

      {/* Back from a download that did not start (download/route.ts). */}
      {error && (
        <p className={`mt-4 ${NOTICE.error}`} role="status">
          {error === 'too_large_export'
            ? limitText(locale, 'drive_export_too_large', r.ok ? r.listing.limits?.max_export_bytes : undefined, 'drive_download_failed')
            : error === 'too_large'
              ? limitText(locale, 'drive_too_large_over', r.ok ? r.listing.limits?.max_download_bytes : undefined, 'drive_too_large')
              : t(locale, DOWNLOAD_ERROR[error] ?? 'drive_download_failed')}
        </p>
      )}

      {!r.ok ? (
        <p className={`mt-6 ${NOTICE.error}`}>{t(locale, ERROR_KEY[r.code])}</p>
      ) : r.listing.items.length === 0 ? (
        <p className="mt-6 text-sm text-ink-muted">{t(locale, 'drive_empty')}</p>
      ) : (
        <ul className={`mt-6 ${ROW_LIST}`}>
          {r.listing.items.map((item) => (
            <li key={item.id} data-item={item.name}>
              <DriveRow item={item} here={here} folder={folder ?? null} maxDownload={r.listing.limits?.max_download_bytes} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}

const ROW = 'flex min-h-11 items-center gap-3 px-4 py-3 text-sm sm:px-5';

/** "Over 250 MB, too large…" when the API told us the cap; the plain
 *  sentence when it did not (an older API). */
function limitText(locale: Locale, withSize: MyKey, bytes: number | undefined, fallback: MyKey): string {
  return bytes ? t(locale, withSize, { size: fmtBytes(bytes, locale) }) : t(locale, fallback);
}

function DriveRow({ item, here, folder, maxDownload, locale }: { item: DriveItem; here: string; folder: string | null; maxDownload?: number; locale: Locale }) {
  if (item.kind === 'folder') {
    return (
      <Link href={`${here}?folder=${encodeURIComponent(item.id)}`} className={`${ROW} text-ink hover:bg-surface-sunken`}>
        <Folder size={18} strokeWidth={1.75} className="shrink-0 text-ink-subtle" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{item.name}</span>
        <ChevronRight size={16} className="shrink-0 text-ink-muted" aria-hidden />
      </Link>
    );
  }
  // What it is: its size (a Google-native file has none), "PDF" when it is
  // exported as one, and when it last changed.
  const facts = [item.export_as === 'pdf' ? t(locale, 'drive_as_pdf') : fmtBytes(item.bytes, locale), t(locale, 'drive_changed', { date: fmtDate(item.modified_at, locale) ?? '' })]
    .filter(Boolean)
    .join(' · ');
  const why = item.downloadable ? null : item.reason === 'too_large' ? limitText(locale, 'drive_too_large_over', maxDownload, 'drive_too_large') : t(locale, 'drive_not_exportable');
  const inner = (
    <>
      <FileText size={18} strokeWidth={1.75} className="shrink-0 text-ink-subtle" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate">{item.name}</span>
        <span className="block text-xs text-ink-muted">{facts}</span>
        {/* On a phone the reason goes under the facts, not beside them. */}
        {why && <span className="block text-xs text-ink-muted sm:hidden">{why}</span>}
      </span>
    </>
  );
  if (!item.downloadable) {
    // Shown, not offered — with the reason, so a missing download does not
    // read as a broken one.
    return (
      <div className={`${ROW} text-ink-subtle`}>
        {inner}
        <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">{why}</span>
      </div>
    );
  }
  return (
    <a href={`${here}/download?file=${encodeURIComponent(item.id)}${folder ? `&folder=${encodeURIComponent(folder)}` : ''}${item.export_as ? '&export=1' : ''}`} className={`${ROW} text-ink hover:bg-surface-sunken`}>
      {inner}
    </a>
  );
}
