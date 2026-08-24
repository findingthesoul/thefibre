import type { ReactNode } from 'react';

// Typography for the four public documents. Kept here rather than in
// components/ui/page.tsx because those primitives use the themed surface/ink
// tokens and these pages are deliberately white-and-neutral, like the landing
// page.

export function DocHeader({
  title,
  standfirst,
  updated,
}: {
  title: string;
  standfirst: string;
  /** ISO date. Shown so a reader can tell which version they agreed to. */
  updated?: string;
}) {
  return (
    <header className="mt-10">
      <h1 className="text-4xl font-medium tracking-tight leading-tight">{title}</h1>
      <p className="mt-4 text-lg text-neutral-600 leading-relaxed">{standfirst}</p>
      {updated && (
        <p className="mt-4 text-xs uppercase tracking-[0.18em] text-neutral-500">
          Last updated{' '}
          {new Date(updated).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}
    </header>
  );
}

export function H2({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <h2 id={id} className="mt-12 text-xl font-medium tracking-tight scroll-mt-8">
      {children}
    </h2>
  );
}

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-4 text-sm text-neutral-700 leading-relaxed">{children}</p>;
}

export function List({ children }: { children: ReactNode }) {
  return <ul className="mt-4 space-y-2 text-sm text-neutral-700 leading-relaxed">{children}</ul>;
}

export function Item({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-5">
      <span className="absolute left-0 top-[0.55em] h-1.5 w-1.5 rounded-full bg-neutral-400" />
      {children}
    </li>
  );
}

/** A two-column reference row — sub-processors, contact addresses. */
export function Row({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="grid gap-1 border-t border-neutral-200 py-3 sm:grid-cols-[13rem_1fr] sm:gap-4">
      <dt className="text-sm font-medium text-neutral-900">{term}</dt>
      <dd className="text-sm text-neutral-600 leading-relaxed">{children}</dd>
    </div>
  );
}

export function Rows({ children }: { children: ReactNode }) {
  return <dl className="mt-4 border-b border-neutral-200">{children}</dl>;
}
