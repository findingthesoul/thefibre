'use client';

// Pick an image from your device, or paste a URL if you already host it.
// Extracted from the certificate builder (2026-09-01) the first time a second
// screen needed it — Settings → Emails & defaults, where the workspace logo
// was URL-only and most people have a PNG, not a URL.
//
// Shared UI lives once. The DateField copies that drifted (v0.13.104) are the
// reason this is not a second implementation.

import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { uploadAsset } from '@/lib/upload';

export function ImageUpload({
  value,
  onChange,
  buttonLabel,
  hint,
  inline = false,
}: {
  value: string;
  onChange: (url: string) => void; // '' clears
  buttonLabel: string;
  hint?: string;
  inline?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAsset(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => void onPick(e)}
    />
  );

  const hasValue = value.trim() !== '';

  if (inline) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {fileInput}
        {hasValue && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value.trim()}
            alt=""
            className="h-8 w-8 rounded-md border border-line object-cover bg-surface-sunken"
          />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-dashed border-line px-2.5 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors disabled:opacity-60"
        >
          <ImagePlus size={13} strokeWidth={1.75} className="shrink-0" />
          {uploading ? 'Uploading…' : buttonLabel}
        </button>
        {hasValue && !uploading && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2"
          >
            Remove
          </button>
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="or paste URL"
          aria-label="Image URL"
          className="h-8 w-40 rounded-md border border-line bg-surface-raised px-2 text-xs focus:border-line-strong focus:outline-none"
        />
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    );
  }

  return (
    <div>
      {fileInput}
      {hasValue ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.trim()}
            alt=""
            className="w-full h-20 rounded-md border border-line object-cover bg-surface-sunken"
          />
          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              disabled={uploading}
              className="text-xs text-ink-subtle hover:text-ink underline underline-offset-2 disabled:opacity-60"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center gap-2 rounded-md border border-dashed border-line px-2.5 py-3 text-xs text-ink-subtle hover:border-line-strong hover:text-ink transition-colors disabled:opacity-60"
          >
            <ImagePlus size={14} strokeWidth={1.75} className="shrink-0" />
            {uploading ? 'Uploading…' : buttonLabel}
          </button>
          {!showUrl && (
            <button
              type="button"
              onClick={() => setShowUrl(true)}
              className="mt-1.5 text-xs text-ink-muted hover:text-ink underline underline-offset-2"
            >
              or paste a URL
            </button>
          )}
        </>
      )}
      {showUrl && (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… image URL"
          aria-label="Image URL"
          className="mt-1.5 w-full h-8 rounded-md border border-line bg-surface-raised px-2 text-xs focus:border-line-strong focus:outline-none"
        />
      )}
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="mt-1.5 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
