'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';
import { toggleFavorite } from './actions';
import { t, type Locale } from '@/lib/i18n-ui';

export function FavoriteStar({
  flowId,
  initial,
  locale,
}: {
  flowId: string;
  initial: boolean;
  locale: Locale;
}) {
  const [fav, setFav] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    const next = !fav;
    setFav(next); // optimistic
    setBusy(true);
    const res = await toggleFavorite(flowId, next);
    setBusy(false);
    if (res.error) setFav(!next); // revert on failure
  }

  return (
    <button
      onClick={onClick}
      title={fav ? t(locale, 'unfavourite') : t(locale, 'favourite')}
      className="p-1 rounded hover:bg-surface-sunken shrink-0"
    >
      <Star
        size={18}
        strokeWidth={1.75}
        className={fav ? 'fill-amber-400 text-amber-500' : 'text-ink-muted'}
      />
    </button>
  );
}
