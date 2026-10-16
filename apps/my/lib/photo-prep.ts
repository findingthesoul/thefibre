// A photo, made ready in the browser before it is uploaded: drawn onto a
// canvas at most 1024px wide or tall, then saved as a JPEG.
//
// Two things fall out of the canvas for free. The orientation a phone wrote
// into EXIF is applied (so the picture stands up), and EVERY piece of
// metadata is gone — EXIF, GPS, XMP — because a canvas holds only pixels.
// The API strips metadata again on its side (lib/strip-metadata.ts); this is
// the half that also fixes the rotation and the size.
//
// If the browser cannot do it (an old one, a format it cannot decode), the
// original file goes up and the server's strip still applies.

const MAX = 1024;

export async function preparePhoto(file: File): Promise<File> {
  try {
    if (typeof createImageBitmap !== 'function') return file;
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88));
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}
