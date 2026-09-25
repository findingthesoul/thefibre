'use client';

// A certificate you were given, on your own page.
//
// Sjoerd, 2026-09-25: *"Certificates (with if you have…) should be in
// my.thread … see certificate thumbnail and a link to online."* Until now a
// certificate existed at a public address and arrived once by email, which
// means the person who earned it had to keep the email to find it again. The
// portal is where everything else of theirs already lives.
//
// A REAL THUMBNAIL, not an icon. The whole point of a certificate is that
// somebody designed it, and a row saying "Certificate · THR-2027-00042" shows
// none of that. It is the same renderer the public page uses
// (@thefibre/shared/ui/cert-view), scaled down by the container, so what you
// see here is the document — not a picture of one that drifts the next time a
// font moves.
//
// The drawing is fetched CLIENT-SIDE, from the public endpoint, on open. Two
// reasons: the snapshot is a page of JSON per certificate and the portal
// payload is already the heaviest call this app makes; and that endpoint is
// public by design, addressed by the number alone, so it needs no session and
// caches like any other static thing.

import { useEffect, useState } from 'react';
import { Award, ExternalLink } from 'lucide-react';
import { CertView, type CertSnapshot } from '@thefibre/shared/ui/cert-view';
import { certificateUrl, fetchCertificate } from '@/lib/portal-api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://thefibre-api.fly.dev';

export function Certificate({
  number,
  issuedAt,
  threadUrl,
}: {
  number: string;
  issuedAt: string;
  threadUrl: string;
}) {
  const [snapshot, setSnapshot] = useState<CertSnapshot | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    void fetchCertificate(number).then((c) => {
      if (!alive) return;
      if (c?.template_snapshot) setSnapshot(c.template_snapshot as CertSnapshot);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [number]);

  const href = certificateUrl(number, threadUrl);

  return (
    <section>
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-muted">Certificate</h3>

      <div className="mt-2 rounded-2xl border border-line bg-surface-sunken p-3">
        {/* Held at the page's aspect while it loads, so opening the sheet does
            not shove the agenda down when the drawing arrives. */}
        <div className="overflow-hidden rounded-lg">
          {snapshot ? (
            <CertView
              snapshot={snapshot}
              apiBase={API_BASE}
              className="cert-page relative w-full overflow-hidden rounded-lg bg-white ring-1 ring-line"
            />
          ) : (
            <div
              className="flex w-full items-center justify-center rounded-lg bg-surface ring-1 ring-line"
              style={{ aspectRatio: '1.4142 / 1' }}
            >
              <Award className="h-6 w-6 text-ink-muted" aria-hidden />
            </div>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-xs text-ink-muted">
            {number} · issued {issued(issuedAt)}
          </p>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-ink underline underline-offset-4"
          >
            View online
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>

        {failed && (
          // The number and the link still work; only the picture is missing.
          // Saying which half failed beats a blank box.
          <p className="mt-1 text-xs text-ink-muted">
            The preview could not be loaded. The link above still opens it.
          </p>
        )}
      </div>
    </section>
  );
}

function issued(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}
