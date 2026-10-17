import { describe, expect, it } from 'vitest';
import { typeLabel, viewKind } from './drive-view';

describe('viewKind', () => {
  it('shows a PDF, a Doc exported as PDF and the four raster types when the API says viewable', () => {
    expect(viewKind({ mime: 'application/pdf', export_as: null, viewable: true })).toBe('pdf');
    expect(viewKind({ mime: 'application/vnd.google-apps.document', export_as: 'pdf', viewable: true })).toBe('pdf');
    for (const m of ['image/png', 'image/jpeg', 'image/webp', 'image/gif']) expect(viewKind({ mime: m, export_as: null, viewable: true })).toBe('image');
  });
  it('never inlines what the API did not mark viewable, or an older API without the field', () => {
    expect(viewKind({ mime: 'application/pdf', export_as: null, viewable: false })).toBe('none');
    expect(viewKind({ mime: 'application/pdf', export_as: null })).toBe('none');
    expect(viewKind({ mime: 'image/png', export_as: null, viewable: undefined })).toBe('none');
  });
  it('does not guess for a scriptable or unknown type, even if marked viewable', () => {
    expect(viewKind({ mime: 'image/svg+xml', export_as: null, viewable: true })).toBe('none');
    expect(viewKind({ mime: 'text/html', export_as: null, viewable: true })).toBe('none');
  });
});

describe('typeLabel', () => {
  it('names the extension, or PDF for an export', () => {
    expect(typeLabel({ name: 'Budget 2027.xlsx', export_as: null })).toBe('XLSX');
    expect(typeLabel({ name: 'Plan', export_as: 'pdf' })).toBe('PDF');
    expect(typeLabel({ name: 'README', export_as: null })).toBeNull();
  });
});
