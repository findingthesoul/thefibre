// THE canonical list — extracted 2026-09-05 (component-inventory Phase 1)
// from the byte-identical web/meet/thread copies.
//
// `ListRow` needs next/link, and this package keeps no Next.js dependency
// (same arrangement as HelpPage in help.tsx): each app's
// components/ui/list.tsx shim calls `createListRow(Link)` with the real
// next/link at module scope and re-exports the result.

import type { ReactNode } from 'react';

export function ListGroup({ children }: { children: ReactNode }) {
  return (
    <ul className="mt-6 divide-y divide-line border border-line rounded-lg bg-surface-raised overflow-hidden">
      {children}
    </ul>
  );
}

export type ListRowProps = {
  href?: string;
  primary: ReactNode;
  secondary?: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
};

/** next/link, structurally. See HelpLink in help.tsx for why it is loose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LinkLike = (props: { href: string; className?: string; children?: any }) => any;

/** Bind the app's next/link once, at module scope, in the shim:
 *  `export const ListRow = createListRow(Link);` */
export function createListRow(LinkComponent: LinkLike) {
  return function ListRow({ href, primary, secondary, meta, trailing }: ListRowProps) {
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
          <LinkComponent href={href} className="block hover:bg-surface-sunken">{inner}</LinkComponent>
        ) : (
          inner
        )}
      </li>
    );
  };
}
