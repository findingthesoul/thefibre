'use client';

import { useRef, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

/**
 * Pick a picture — a profile photo, a workspace logo.
 *
 * The Thread had this; The Fibre asked people to paste a URL, which is not a
 * worse design so much as none: nobody has a URL for a photograph that is on
 * their phone. Sjoerd, 2026-09-01: "it should be one, and The Thread should be
 * leading". So the better one moved here and both apps use it.
 *
 * `upload` is injected rather than imported. Each app talks to the API with
 * its own session and its own X-App-ID, and a shared component that reached
 * for one app's client would work in that app and mysteriously fail in the
 * next.
 *
 * The value is held by the caller (`value` / `onChange`) and posted as a
 * hidden input, so a form that submits by FormData still finds it.
 */
export function PhotoField({
  label,
  name,
  value,
  onChange,
  upload,
  hint,
  shape = 'circle',
  onError,
}: {
  label: string;
  /** Hidden input name, for forms read with FormData. */
  name?: string | undefined;
  value: string | null;
  onChange: (url: string | null) => void;
  upload: (file: File) => Promise<string>;
  hint?: string | undefined;
  /** A face is round; a logo is not. */
  shape?: 'circle' | 'square' | undefined;
  onError?: ((message: string) => void) | undefined;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      onChange(await upload(file));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'upload failed');
    } finally {
      setUploading(false);
      // Cleared so choosing the same file twice still fires a change.
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <span className="text-sm text-ink-subtle">{label}</span>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pick} />
      {name && <input type="hidden" name={name} value={value ?? ''} />}
      {value ? (
        <div className="mt-1 flex items-center gap-3">
          {/* A face is cropped to a circle; a logo is not cropped at all.
              Wordmarks are wide — squeezing one into a square box showed
              "festiv / tru" and called it a logo. Fixed height, free width,
              nothing cut off.

              eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className={
              shape === 'circle'
                ? 'h-16 w-16 rounded-full object-cover ring-1 ring-line'
                : 'h-16 w-auto max-w-[240px] rounded-md border border-line bg-white object-contain p-2'
            }
          />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="text-xs text-ink-subtle hover:text-ink text-left"
            >
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-xs text-ink-subtle hover:text-ink inline-flex items-center gap-1"
            >
              <X size={11} strokeWidth={1.75} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="mt-1 w-full rounded-md border-2 border-dashed border-line hover:border-yellow-400 hover:bg-yellow-50/50 text-ink-subtle hover:text-ink py-4 text-sm inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          <ImagePlus size={16} strokeWidth={1.75} />
          {uploading ? 'Uploading…' : `Upload ${label.toLowerCase()}`}
        </button>
      )}
      {hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}
