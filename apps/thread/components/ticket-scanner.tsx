'use client';

// Reading a ticket QR and saying yes or no, at arm's length.
//
// Extracted from the per-thread door list (2026-09-10) so the workspace-wide
// scanner can use the SAME code. It was the only scanner in the product and
// it lives at an actual door with an actual queue, so copying it was not an
// option: a fork failing quietly means people waiting outside.
//
// The seam: this component owns reading a code and showing the verdict. What
// a code MEANS belongs to the caller, which is the whole difference between
// the two scanners — the door of one thread refuses a ticket for another
// event, the workspace scanner admits it and names the event.

import { useEffect, useRef, useState } from 'react';
import { Camera, CameraOff } from 'lucide-react';
import type { Locale } from '@thefibre/shared';
import { t } from '@/lib/i18n-ui';
import type { ScanVerdict } from '@/app/(app)/threads/actions';

/** A ticket QR encodes the check-in URL; the code is its last segment. */
const THREAD_CODE = /\/checkin\/([0-9a-fA-F]{32})\b/;
const FLASH_MS = 2600;
/** One ticket held in front of the lens reads many times a second. */
const REPEAT_MS = 3000;

export function TicketScanner({
  locale,
  onScan,
  onScanningChange,
  children,
}: {
  locale: Locale;
  /** What this code means. Returning the verdict lets the caller act on it
   *  too — the door list ticks its own row when somebody is admitted. */
  onScan: (code: string) => Promise<ScanVerdict>;
  /** Told when the camera starts and stops. The door list freezes its rows
   *  while it is live — a thumb resting on a row must not admit somebody
   *  mid-scan — and that behaviour has to survive the extraction. */
  onScanningChange?: (scanning: boolean) => void;
  /** Rendered under the camera while it is running — the manual check-in
   *  door out, on the workspace scanner. */
  children?: React.ReactNode;
}) {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scanningChangeRef = useRef(onScanningChange);
  useEffect(() => {
    scanningChangeRef.current = onScanningChange;
  });
  useEffect(() => {
    scanningChangeRef.current?.(scanning);
  }, [scanning]);
  const [flash, setFlash] = useState<ScanVerdict | null>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const lastCode = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  // The camera effect is bound once; this is how it reaches today's handler.
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  });

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
    new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

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
      const now = Date.now();
      if (lastCode.current.code === code && now - lastCode.current.at < REPEAT_MS) return;
      lastCode.current = { code, at: now };
      void onScanRef.current(code.toLowerCase()).then(showFlash);
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
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning]);

  useEffect(() => () => void (flashTimer.current && clearTimeout(flashTimer.current)), []);

  const admitted = flash?.kind === 'admitted';

  return (
    <>
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
                ? t(locale, 'already_checked_in_at', { name: flash.name, time: fmtTime(flash.at) })
                : flash.reason}
          </p>
          {/* Which event, on the workspace scanner — the one thing a global
              scan can get wrong that a per-thread one cannot. */}
          {flash.kind === 'admitted' && flash.threadTitle && (
            <p className="mt-2 text-[clamp(1rem,3vw,1.5rem)] opacity-90">{flash.threadTitle}</p>
          )}
          <p className="mt-3 text-sm opacity-80">
            {admitted ? t(locale, 'checked_in') : t(locale, 'not_admitted')}
          </p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setScanning((s) => !s)}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium ${
          scanning ? 'bg-ink text-ink-inverse' : 'border border-line text-ink hover:bg-surface-sunken'
        }`}
      >
        {scanning ? <CameraOff size={15} strokeWidth={1.75} /> : <Camera size={15} strokeWidth={1.75} />}
        {scanning ? t(locale, 'stop_scanning') : t(locale, 'scan_tickets')}
      </button>

      {scanning && (
        <>
          <div className="mt-3 overflow-hidden rounded-xl border border-line bg-black">
            <video ref={video} playsInline muted className="h-56 w-full object-cover" />
          </div>
          {children}
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
    </>
  );
}
