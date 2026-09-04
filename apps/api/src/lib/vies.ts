// VIES — the EU's official VAT-number validation service, called directly
// (free), part of taking tax collection in-house (Sjoerd, 2026-09-04).
// VIES is famously flaky; soft-fail with 'unavailable' and let the caller
// retry later rather than punishing a customer for Brussels' uptime.

export type ViesResult = 'valid' | 'invalid' | 'unavailable';

export async function validateVatNumber(vatId: string): Promise<ViesResult> {
  const m = vatId.replace(/\s+/g, '').toUpperCase().match(/^([A-Z]{2})([A-Z0-9]{2,15})$/);
  if (!m) return 'invalid';
  const [, countryCode, vatNumber] = m;
  try {
    const r = await fetch(
      'https://ec.europa.eu/taxation_customs/vies/rest-api/check-vat-number',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryCode, vatNumber }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!r.ok) return 'unavailable';
    const data = (await r.json()) as { valid?: boolean };
    return data.valid === true ? 'valid' : 'invalid';
  } catch {
    return 'unavailable';
  }
}
