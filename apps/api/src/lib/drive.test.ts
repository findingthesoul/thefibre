import { describe, expect, it } from 'vitest';
import { DRIVE_LIMITS, descriptionProves, driveServiceAccount, folderIdFromUrl, issueCode, orderItems, toItem, verifyCode } from './drive.js';

const ENV = { SSO_INTERNAL_SECRET: 'test-secret' };
const WS = '11111111-1111-1111-1111-111111111111';
const FOLDER = '1AbCdEfGhIjKlMnOp';
const HOUR = 3_600_000;

describe('a Drive folder link', () => {
  it('gives the folder id, from every shape Drive hands out', () => {
    expect(folderIdFromUrl(`https://drive.google.com/drive/folders/${FOLDER}`)).toBe(FOLDER);
    expect(folderIdFromUrl(`https://drive.google.com/drive/folders/${FOLDER}?usp=sharing`)).toBe(FOLDER);
    expect(folderIdFromUrl(`https://drive.google.com/drive/u/0/folders/${FOLDER}/`)).toBe(FOLDER);
    expect(folderIdFromUrl(`https://drive.google.com/open?id=${FOLDER}`)).toBe(FOLDER);
  });
  it('refuses a file link, another host, http, and junk', () => {
    expect(folderIdFromUrl(`https://drive.google.com/file/d/${FOLDER}/view`)).toBeNull();
    expect(folderIdFromUrl(`https://evil.example/drive/folders/${FOLDER}`)).toBeNull();
    expect(folderIdFromUrl(`http://drive.google.com/drive/folders/${FOLDER}`)).toBeNull();
    expect(folderIdFromUrl(`https://drive.google.com/drive/folders/x'%20or%20'1`)).toBeNull();
    expect(folderIdFromUrl(42)).toBeNull();
  });
});

describe('the one-time code', () => {
  it('is bound to the workspace and the folder', () => {
    const c = verifyCode(WS, FOLDER, 100, ENV);
    expect(c).toMatch(/^fibre-verify-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(verifyCode('22222222-2222-2222-2222-222222222222', FOLDER, 100, ENV)).not.toBe(c);
    expect(verifyCode(WS, '1ZZZZZZZZZZZZZZZZ', 100, ENV)).not.toBe(c);
  });

  it('issued at 10:59 still proves at 11:30; not at 12:00 (the hour edge)', () => {
    const at1059 = 10 * HOUR + 59 * 60_000;
    const { code, expires_at } = issueCode(WS, FOLDER, at1059, ENV);
    expect(new Date(expires_at).getTime()).toBe(12 * HOUR);
    expect(descriptionProves(`Our repository. ${code}`, WS, FOLDER, at1059, ENV)).toBe(true);
    expect(descriptionProves(code, WS, FOLDER, 11 * HOUR + 30 * 60_000, ENV)).toBe(true);
    expect(descriptionProves(code, WS, FOLDER, 12 * HOUR, ENV)).toBe(false);
  });

  it('another community’s code, a lookalike, or nothing proves nothing', () => {
    const now = 50 * HOUR;
    const other = issueCode('22222222-2222-2222-2222-222222222222', FOLDER, now, ENV).code;
    expect(descriptionProves(other, WS, FOLDER, now, ENV)).toBe(false);
    expect(descriptionProves('fibre-verify-AAAA-AAAA', WS, FOLDER, now, ENV)).toBe(false);
    expect(descriptionProves(null, WS, FOLDER, now, ENV)).toBe(false);
  });

  it('needs a key with its own label: no secret, no code', () => {
    expect(() => verifyCode(WS, FOLDER, 1, {})).toThrow();
  });
});

describe('what a member sees of a file', () => {
  const at = '2026-10-17T08:00:00.000Z';
  it('a folder, a PDF, a Doc (as PDF), a form (not exportable), a huge file (too large)', () => {
    expect(toItem({ id: 'f1', name: 'Sub', mimeType: 'application/vnd.google-apps.folder', modifiedTime: at })).toMatchObject({ kind: 'folder', downloadable: false, reason: null, export_as: null, bytes: null });
    expect(toItem({ id: 'f2', name: 'a.pdf', mimeType: 'application/pdf', size: '1000', modifiedTime: at })).toMatchObject({ kind: 'file', bytes: 1000, downloadable: true, reason: null, export_as: null });
    expect(toItem({ id: 'f3', name: 'Notes', mimeType: 'application/vnd.google-apps.document', modifiedTime: at })).toMatchObject({ export_as: 'pdf', bytes: null, downloadable: true, reason: null });
    expect(toItem({ id: 'f4', name: 'Survey', mimeType: 'application/vnd.google-apps.form', modifiedTime: at })).toMatchObject({ downloadable: false, reason: 'not_exportable' });
    expect(toItem({ id: 'f5', name: 'Short', mimeType: 'application/vnd.google-apps.shortcut', modifiedTime: at })).toMatchObject({ downloadable: false, reason: 'not_exportable' });
    expect(toItem({ id: 'f6', name: 'big.mov', mimeType: 'video/quicktime', size: String(DRIVE_LIMITS.max_download_bytes + 1), modifiedTime: at })).toMatchObject({ downloadable: false, reason: 'too_large' });
  });

  it('folders first, then files, by name', () => {
    const items = [
      toItem({ id: '1', name: 'b.pdf', mimeType: 'application/pdf', size: '1' }),
      toItem({ id: '2', name: 'Zeta', mimeType: 'application/vnd.google-apps.folder' }),
      toItem({ id: '3', name: 'a.pdf', mimeType: 'application/pdf', size: '1' }),
      toItem({ id: '4', name: 'alpha', mimeType: 'application/vnd.google-apps.folder' }),
    ];
    expect(orderItems(items).map((i) => i.name)).toEqual(['alpha', 'Zeta', 'a.pdf', 'b.pdf']);
  });
});

describe('the service account', () => {
  const json = JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: 'k' });
  it('reads base64 (the Fly secret) or plain JSON; anything else is not configured', () => {
    expect(driveServiceAccount({ GOOGLE_DRIVE_SA_JSON: Buffer.from(json).toString('base64') })?.client_email).toBe('sa@p.iam.gserviceaccount.com');
    expect(driveServiceAccount({ GOOGLE_DRIVE_SA_JSON: json })?.client_email).toBe('sa@p.iam.gserviceaccount.com');
    expect(driveServiceAccount({})).toBeNull();
    expect(driveServiceAccount({ GOOGLE_DRIVE_SA_JSON: 'bm90IGpzb24=' })).toBeNull();
  });
});

describe('the download token (slice 3)', () => {
  it('reads back what it signed, for 60 seconds', async () => {
    const { readDownload, signDownload } = await import('./drive.js');
    const t = signDownload({ w: WS, d: 'doc1', f: 'file1', p: 'person1' }, 1_000_000, ENV);
    expect(readDownload(t, 1_000_000 + 59_000, ENV)).toMatchObject({ w: WS, d: 'doc1', f: 'file1', p: 'person1' });
    expect(readDownload(t, 1_000_000 + 61_000, ENV)).toBeNull();
  });
  it('a changed claim, another key, or junk reads as nothing', async () => {
    const { readDownload, signDownload } = await import('./drive.js');
    const t = signDownload({ w: WS, d: 'doc1', f: 'file1', p: 'person1' }, 1_000_000, ENV);
    const [, mac] = t.split('.');
    const forged = `${Buffer.from(JSON.stringify({ w: WS, d: 'doc1', f: 'OTHER', p: 'person1', x: 9e15 })).toString('base64url')}.${mac}`;
    expect(readDownload(forged, 1_000_000, ENV)).toBeNull();
    expect(readDownload(t, 1_000_000, { SSO_INTERNAL_SECRET: 'another' })).toBeNull();
    expect(readDownload('nope', 1_000_000, ENV)).toBeNull();
    expect(readDownload(undefined, 1_000_000, ENV)).toBeNull();
  });
});

describe('the saved name', () => {
  it('an export gets .pdf; nothing that breaks a header survives', async () => {
    const { downloadName } = await import('./drive.js');
    expect(downloadName('Guide', 'pdf')).toBe('Guide.pdf');
    expect(downloadName('Guide.PDF', 'pdf')).toBe('Guide.PDF');
    expect(downloadName('a.jpg', null)).toBe('a.jpg');
    expect(downloadName('evil"\r\nX-Header: 1', null)).toBe('evil X-Header: 1');
    expect(downloadName('  ', null)).toBe('file');
  });
});

describe('the listing cache is bounded', () => {
  it('keeps at most LIST_CACHE_MAX entries, dropping the oldest', async () => {
    const { LIST_CACHE_MAX, _listCacheSize, _remember, _resetDriveToken } = await import('./drive.js');
    _resetDriveToken();
    const v = { folder: { id: 'x', name: 'x' }, breadcrumbs: [], items: [], limits: DRIVE_LIMITS };
    for (let i = 0; i < LIST_CACHE_MAX + 50; i++) _remember(`k${i}`, v);
    expect(_listCacheSize()).toBe(LIST_CACHE_MAX);
  });
});
