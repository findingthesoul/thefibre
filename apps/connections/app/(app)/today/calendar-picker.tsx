'use client';

// Which calendars feed the agenda.
//
// Sjoerd, 2026-09-21: *"In the interface: select agenda's available to me.
// And select one or more. Maybe popup. And then put agenda's on and off."*
//
// A popup, as asked, and opened from beside the agenda heading rather than
// buried in Settings: the moment you want to change this is the moment you
// are looking at a day with the wrong meetings in it.
//
// The dialog sends EVERY calendar it showed, not just the ones touched, so
// after a save the stored choice is complete. The API's "absent means the
// default" then only applies to a calendar made later, which is exactly when
// defaulting is right again.

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarCog } from 'lucide-react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { Switch } from '@thefibre/shared/ui/switch';
import { Button } from '@/components/ui/button';
import { t, type Locale } from '@/lib/i18n-ui';
import { loadCalendars, saveCalendars, type AgendaCalendar } from './agenda-actions';

export function CalendarPicker({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<AgendaCalendar[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [saving, start] = useTransition();

  // Read on opening, not on rendering Today: this costs a Google round trip
  // and almost nobody opens it. Re-read on every open, because the answer
  // changes at Google, not here.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setList(null);
    setUnavailable(false);
    loadCalendars().then((r) => {
      if (!live) return;
      if (r.unavailable) setUnavailable(true);
      setList(r.calendars);
    });
    return () => {
      live = false;
    };
  }, [open]);

  const toggle = (id: string, on: boolean) =>
    setList((cur) => cur?.map((c) => (c.id === id ? { ...c, enabled: on } : c)) ?? cur);

  const save = () =>
    start(async () => {
      if (!list) return;
      const r = await saveCalendars(list.map((c) => ({ id: c.id, enabled: c.enabled })));
      if (!r.ok) return; // the dialog stays open with the choice intact
      setOpen(false);
      router.refresh();
    });

  const mine = list?.filter((c) => c.owned) ?? [];
  const followed = list?.filter((c) => !c.owned) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs text-ink-muted transition-colors hover:text-ink"
      >
        <CalendarCog size={14} strokeWidth={1.75} />
        {t(locale, 'agenda_calendars')}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={t(locale, 'agenda_calendars')}
        description={t(locale, 'agenda_calendars_intro')}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {t(locale, 'cancel')}
            </Button>
            <Button type="button" variant="save" onClick={save} disabled={saving || !list}>
              {saving ? t(locale, 'saving') : t(locale, 'save')}
            </Button>
          </div>
        }
      >
        {list === null && <p className="text-sm text-ink-muted">{t(locale, 'loading')}</p>}
        {unavailable && <p className="text-sm text-ink-muted">{t(locale, 'agenda_unavailable')}</p>}

        {list !== null && !unavailable && list.length === 0 && (
          <p className="text-sm text-ink-muted">{t(locale, 'agenda_calendars_none')}</p>
        )}

        {[
          { key: 'mine', label: t(locale, 'agenda_calendars_mine'), rows: mine },
          { key: 'followed', label: t(locale, 'agenda_calendars_followed'), rows: followed },
        ]
          .filter((g) => g.rows.length > 0)
          .map((g) => (
            <div key={g.key} className="mt-4 first:mt-0">
              {/* Named groups because the default differs between them: your
                  own are on unless you say otherwise, a calendar you only
                  follow is off unless you ask for it. */}
              <h3 className="text-[10px] uppercase tracking-wider text-ink-muted">{g.label}</h3>
              {/* No rules between the rows. Sjoerd, 2026-09-21, looking at
                  this popup: "remove the lines between agenda's". A short
                  named group with a switch on each row is already legible as
                  a list; a hairline per row turns four calendars into a
                  table. The row list on Today keeps its lines because it is
                  long and every row is a different kind of thing. */}
              <ul className="mt-1.5">
                {g.rows.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-sm">{c.summary}</span>
                      {c.primary && (
                        <span className="block text-xs text-ink-subtle">
                          {t(locale, 'agenda_calendars_primary')}
                        </span>
                      )}
                    </span>
                    <Switch
                      checked={c.enabled}
                      onChange={(v) => toggle(c.id, v)}
                      label={undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </Dialog>
    </>
  );
}
