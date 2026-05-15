import Link from 'next/link';
import type { ReactNode } from 'react';

export function ListGroup({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
      {children}
    </ul>
  );
}

type RowProps = {
  href?: string;
  primary: ReactNode;
  secondary?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
};

export function ListRow({ href, primary, secondary, meta, trailing }: RowProps) {
  const inner = (
    <div className="flex items-baseline justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <div className="font-medium truncate">{primary}</div>
        {secondary && <div className="text-sm text-ink-subtle truncate">{secondary}</div>}
      </div>
      <div className="text-xs text-ink-muted shrink-0 flex items-center gap-3">
        {meta}
        {trailing}
      </div>
    </div>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="block hover:bg-surface-sunken">{inner}</Link>
      ) : (
        inner
      )}
    </li>
  );
}
