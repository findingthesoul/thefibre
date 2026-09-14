'use client';

// The tag clean-up list.
//
// Sjoerd, 2026-09-14: *"Look for doubles... look for ones that have not been
// used for a long time... present a list for cleaning once in a while."*
//
// Everything here is a PROPOSAL somebody acts on. A near-spelling is sometimes
// two real things, so each double has "Not the same", which is remembered on
// this device and keeps that pair off the list next time.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { t, INTL_LOCALES, type Locale } from '@/lib/i18n-ui';
import { safely } from '@/lib/safely';
import { markTagCleaningSeen, notTheSame, notTheSameKey } from '@/lib/tag-cleaning-seen';
import { deleteTag, mergeTags, renameTag, type CleanTag, type TagActResult, type TagCleaning } from './actions';

const REASON_KEYS = {
  spelling: 'tagclean_reason_spelling',
  plural: 'tagclean_reason_plural',
  typo: 'tagclean_reason_typo',
} as const;

type Pending ={ kind: 'delete'; tag: CleanTag } | { kind: 'delete-unused' } | null;

export function TagCleaningList({ data, locale }: { data: TagCleaning; locale: Locale }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Pending>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [keepChoice, setKeepChoice] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const edit = data.can_edit;

  useEffect(() => {
    markTagCleaningSeen();
    setDismissed(notTheSame.read());
  }, []);

  const run = async (fn: () => Promise<TagActResult>) => {
    setBusy(true);
    setError(null);
    const r = await safely(fn, () => ({ ok: false as const, error: 'unknown error' }));
    setBusy(false);
    if (!r.ok) {
      setError(
        r.error === 'forbidden'
          ? t(locale, 'tagclean_forbidden')
          : r.error === 'name_taken'
            ? t(locale, 'tagclean_name_taken')
            : r.error,
      );
      return false;
    }
    router.refresh();
    return true;
  };

  const when = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], { dateStyle: 'medium' }).format(new Date(iso));
  const chip = (tg: CleanTag) => (
    <span className="inline-flex items-baseline gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-sm">
      #{tg.name}
      <span className="text-xs text-ink-subtle tabular-nums">{tg.people}</span>
    </span>
  );

  const doubles = data.doubles.filter((g) => !dismissed.has(notTheSameKey([g.keep, ...g.others].map((m) => m.id))));
  const nothing = doubles.length === 0 && data.unused.length === 0 && data.stale.length === 0;

  return (
    <div className="mt-6 max-w-3xl space-y-10">
      {!edit && <p className="text-sm text-ink-muted">{t(locale, 'tagclean_read_only')}</p>}
      {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
      {nothing && <p className="text-sm text-ink-muted">{t(locale, 'tagclean_nothing')}</p>}

      {doubles.length > 0 && (
        <section>
          <h2 className="text-sm font-medium">{t(locale, 'tagclean_doubles_title')}</h2>
          <p className="mt-1 text-xs text-ink-muted">{t(locale, 'tagclean_doubles_hint')}</p>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {doubles.map((g) => {
              const members = [g.keep, ...g.others];
              const key = notTheSameKey(members.map((m) => m.id));
              const keepId = keepChoice[key] ?? g.keep.id;
              const keep = members.find((m) => m.id === keepId)!;
              const from = members.filter((m) => m.id !== keepId).map((m) => m.id);
              return (
                <li key={key} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <span className="flex flex-wrap items-center gap-1.5">{members.map((m) => <span key={m.id}>{chip(m)}</span>)}</span>
                  <span className="text-xs text-ink-subtle">{t(locale, REASON_KEYS[g.reason])}</span>
                  {edit && (
                    <span className="ml-auto flex items-center gap-2">
                      <label className="flex items-center gap-1 text-xs text-ink-muted">
                        {t(locale, 'tagclean_keep')}
                        <select
                          value={keepId}
                          onChange={(e) => setKeepChoice((c) => ({ ...c, [key]: e.target.value }))}
                          className="rounded-md border border-line bg-surface px-1.5 py-1 text-xs"
                          // Two organisations never reach this list, so at
                          // most one member names one; keeping a plain word
                          // over it still hands the organisation on.
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              #{m.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <Button size="sm" disabled={busy} onClick={() => void run(() => mergeTags(keep.id, from))}>
                        {t(locale, 'tagclean_merge')}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => {
                          notTheSame.add(key);
                          setDismissed(notTheSame.read());
                        }}
                      >
                        {t(locale, 'tagclean_not_same')}
                      </Button>
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {data.unused.length > 0 && (
        <section>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium">{t(locale, 'tagclean_unused_title')}</h2>
              <p className="mt-1 text-xs text-ink-muted">{t(locale, 'tagclean_unused_hint')}</p>
            </div>
            {edit && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ kind: 'delete-unused' })}>
                {t(locale, 'tagclean_delete_all', { n: data.unused.length })}
              </Button>
            )}
          </div>
          <p className="mt-3 flex flex-wrap gap-1.5">
            {data.unused.map((tg) => (
              <span key={tg.id}>{chip(tg)}</span>
            ))}
          </p>
        </section>
      )}

      {data.stale.length > 0 && (
        <section>
          <h2 className="text-sm font-medium">{t(locale, 'tagclean_stale_title', { n: Math.round(data.stale_days / 30) })}</h2>
          <p className="mt-1 text-xs text-ink-muted">{t(locale, 'tagclean_stale_hint')}</p>
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {data.stale.map((tg) => (
              <li key={tg.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                {renaming?.id === tg.id ? (
                  <form
                    className="flex items-center gap-2"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (await run(() => renameTag(tg.id, renaming.name))) setRenaming(null);
                    }}
                  >
                    <input
                      autoFocus
                      value={renaming.name}
                      onChange={(e) => setRenaming({ id: tg.id, name: e.target.value })}
                      className="rounded-md border border-line bg-surface px-2 py-1 text-sm"
                    />
                    <Button size="sm" type="submit" disabled={busy || !renaming.name.trim()}>
                      {t(locale, 'save')}
                    </Button>
                    <Button size="sm" variant="ghost" type="button" onClick={() => setRenaming(null)}>
                      {t(locale, 'cancel')}
                    </Button>
                  </form>
                ) : (
                  chip(tg)
                )}
                <span className="text-xs text-ink-subtle">
                  {t(locale, 'tagclean_last_used', { date: when(tg.last_used!) })}
                </span>
                {edit && renaming?.id !== tg.id && (
                  <span className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRenaming({ id: tg.id, name: tg.name })}>
                      {t(locale, 'tagclean_rename')}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm({ kind: 'delete', tag: tg })}>
                      {t(locale, 'delete')}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ConfirmDialog
        open={confirm !== null}
        destructive
        pending={busy}
        onCancel={() => setConfirm(null)}
        title={t(locale, 'tagclean_confirm_title')}
        message={
          confirm?.kind === 'delete'
            ? t(locale, 'tagclean_confirm_one', { name: confirm.tag.name, n: confirm.tag.people })
            : t(locale, 'tagclean_confirm_unused', { n: data.unused.length })
        }
        confirmLabel={t(locale, 'delete')}
        onConfirm={async () => {
          const c = confirm;
          if (!c) return;
          const ok =
            c.kind === 'delete'
              ? await run(() => deleteTag(c.tag.id))
              : await run(async () => {
                  for (const tg of data.unused) {
                    const r = await deleteTag(tg.id);
                    if (!r.ok) return r;
                  }
                  return { ok: true };
                });
          if (ok) setConfirm(null);
        }}
      />
    </div>
  );
}
