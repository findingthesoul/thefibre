'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Camera, CameraOff, CheckCircle2, Search, Undo2 } from 'lucide-react';
import { INTL_LOCALES, type Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import { checkinEnrolment, scanTicket, type ScanVerdict } from '../../actions';

export type DoorRow = {
  id: string;
  name: string;
  email: string | null;
  status: string | null;
  payment_status: string | null;
  checked_in_at: string | null;
};

// Every ticket carries its own address; the id inside it is the guest.
const THREAD_CODE = /(?:checkin\/)?([0-9a-f]{32})/i;
const FLASH_MS = 2200;
const REPEAT_MS = 4000;

export function DoorList({
  locale,
  threadId,
  initialRows,
  timezone,
}: {
  locale: Locale;
  threadId: string;
  initialRows: DoorRow[];
  timezone: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  // The scan's answer, written across the whole screen for a moment — the
  // person at the door reads it at arm's length, phone half-turned toward
  // the guest.
  const [flash, setFlash] = useState<ScanVerdict | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scanning, setScanning] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const lastCode = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  function showFlash(v: ScanVerdict) {
    if (flashTimer.current) clearTimeout(flashTimer.current);
    setFlash(v);
    try {
      navigator.vibrate?.(v.kind === 'admitted' ? 80 : [60, 60, 60]);
    } catch {
      /* no vibration on this device — the colour is the signal */
    }
    flashTimer.current = setTimeout(() => setFlash(null), FLASH_MS);
  }

  const fmtTime = (iso: string) =>
    new Intl.DateTimeFormat(INTL_LOCALES[locale], {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(iso));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.name.toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q),
    );
  }, [rows, query]);

  const checkedIn = rows.filter((r) => r.checked_in_at).length;

  function toggle(row: DoorRow) {
    // One door at a time: while the camera is live, the list is for looking
    // at. A thumb resting on a row must not admit somebody mid-scan.
    if (scanning) return;
    const undo = !!row.checked_in_at;
    setError(null);
    setBusyId(row.id);
    startTransition(async () => {
      const r = await checkinEnrolment(threadId, row.id, undo);
      setBusyId(null);
      if (!r.ok) return setError(r.error);
      setRows((rs) =>
        rs.map((x) => (x.id === row.id ? { ...x, checked_in_at: r.checked_in_at } : x)),
      );
    });
  }

  // The camera loop lives and dies with the scanning flag.
  useEffect(() => {
    if (!scanning) return;
    let stream: MediaStream | null = null;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const onCode = (raw: string) => {
      const code = THREAD_CODE.exec(raw)?.[1];
      if (!code) {
        showFlash({ kind: 'refused', reason: t(locale, 'not_a_ticket') });
        return;
      }
      // One ticket held in front of the lens reads many times a second; without
      // this the screen would strobe.
      const now = Date.now();
      if (lastCode.current.code === code && now - lastCode.current.at < REPEAT_MS) return;
      lastCode.current = { code, at: now };
      startTransition(async () => {
        const v = await scanTicket(threadId, code.toLowerCase());
        showFlash(v);
        if (v.kind === 'admitted') {
          setRows((rs) =>
            rs.map((x) =>
              x.name === v.name && !x.checked_in_at
                ? { ...x, checked_in_at: new Date().toISOString() }
                : x,
            ),
          );
        }
      });
    };

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stop || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();

        // BarcodeDetector is a trap on desktop browsers: the constructor
        // exists while the implementation does not, and detect() answers []
        // forever. Only trust it when it names qr_code as supported — and
        // keep the JavaScript decoder as the working fallback (Safari).
        const Detector = (
          window as Window & {
            BarcodeDetector?: {
              new (o: { formats: string[] }): {
                detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
              };
              getSupportedFormats?: () => Promise<string[]>;
            };
          }
        ).BarcodeDetector;
        let detector: {
          detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
        } | null = null;
        if (Detector) {
          try {
            const formats = (await Detector.getSupportedFormats?.()) ?? [];
            if (formats.includes('qr_code')) detector = new Detector({ formats: ['qr_code'] });
          } catch {
            /* fall through to jsQR */
          }
        }
        const jsqr = detector ? null : (await import('jsqr')).default;
        const canvas = document.createElement('canvas');

        const tick = async () => {
          if (stop || !video.current) return;
          try {
            if (detector) {
              const codes = await detector.detect(video.current);
              for (const c of codes) onCode(c.rawValue);
            } else if (jsqr && video.current.videoWidth) {
              canvas.width = video.current.videoWidth;
              canvas.height = video.current.videoHeight;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(video.current, 0, 0);
                const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const hit = jsqr(img.data, img.width, img.height);
                if (hit?.data) onCode(hit.data);
              }
            }
          } catch {
            /* a bad frame is not an error worth showing */
          }
          timer = setTimeout(tick, 350);
        };
        void tick();
      } catch {
        setError(t(locale, 'camera_error'));
        setScanning(false);
      }
    })();

    return () => {
      stop = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // threadId is stable for the page's life; startTransition is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), []);

  const admitted = flash?.kind === 'admitted';

  return (
    <div className="mt-4">
      {/* The verdict, full screen. Scanning continues underneath it. */}
      {flash && (
        <div
          role="alert"
          aria-live="assertive"
          onClick={() => setFlash(null)}
          className={`fixed inset-0 z-[100] flex flex-col items-center justify-center px-8 text-center text-white ${
            admitted ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          <span className="text-[clamp(4rem,20vw,9rem)] leading-none" aria-hidden="true">
            {admitted ? '✓' : '✕'}
          </span>
          <p className="mt-4 text-[clamp(1.5rem,6vw,3rem)] font-bold leading-tight text-balance">
            {flash.kind === 'admitted'
              ? flash.name
              : flash.kind === 'already'
                ? t(locale, 'already_checked_in_at', {
                    name: flash.name,
                    time: fmtTime(flash.at),
                  })
                : flash.reason}
          </p>
          <p className="mt-3 text-sm opacity-80">
            {admitted ? t(locale, 'checked_in') : t(locale, 'not_admitted')}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 text-sm text-ink-subtle">
        <span>
          <strong className="font-medium text-ink">{checkedIn}</strong> / {rows.length}{' '}
          {t(locale, 'checked_in_lower')}
        </span>
        <button
          type="button"
          onClick={() => setScanning((s) => !s)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${
            scanning
              ? 'bg-ink text-ink-inverse'
              : 'border border-line text-ink hover:bg-surface-sunken'
          }`}
        >
          {scanning ? <CameraOff size={15} strokeWidth={1.75} /> : <Camera size={15} strokeWidth={1.75} />}
          {scanning ? t(locale, 'stop_scanning') : t(locale, 'scan_tickets')}
        </button>
      </div>

      {scanning && (
        <div className="mt-3 overflow-hidden rounded-xl border border-line bg-black">
          <video ref={video} playsInline muted className="h-56 w-full object-cover" />
        </div>
      )}

      <div className="relative mt-3">
        <Search
          size={16}
          strokeWidth={1.75}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(locale, 'search_name_email')}
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-line bg-surface pl-10 pr-4 text-base outline-none focus:border-ink"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {scanning && (
        <p className="mt-3 text-xs text-ink-muted">{t(locale, 'camera_is_door')}</p>
      )}

      <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-surface">
        {visible.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-ink-subtle">
            {rows.length === 0 ? t(locale, 'nobody_registered') : t(locale, 'no_match')}
          </li>
        )}
        {visible.map((r) => {
          const done = !!r.checked_in_at;
          const note =
            r.status === 'invited'
              ? t(locale, 'not_approved_yet')
              : r.payment_status === 'pending'
                ? t(locale, 'payment_pending_lower')
                : null;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => toggle(r)}
                disabled={busyId === r.id || scanning}
                aria-disabled={scanning}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-sunken disabled:opacity-50 disabled:hover:bg-transparent"
              >
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[15px] ${done ? 'text-ink-subtle' : ''}`}>
                    {r.name}
                  </span>
                  {note && <span className="block text-xs text-amber-700">{note}</span>}
                </span>
                {done ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-green-700">
                    <CheckCircle2 size={18} />
                    {fmtTime(r.checked_in_at!)}
                    {!scanning && <Undo2 size={13} className="ml-1 text-ink-muted" />}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium">
                    {t(locale, 'check_in')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
