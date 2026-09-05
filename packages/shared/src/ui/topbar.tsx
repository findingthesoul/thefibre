import type { ReactNode } from 'react';

// The topbar frame (extraction phase 3). The six app topbars were
// byte-identical wiring: AppSwitcher left, UserMenu right, one header bar.
// The composed pieces stay app-side (they carry server actions and the app
// list); the frame and the initials rule live here.

export function initialsOf(fullName: string, email: string): string {
  return (
    (fullName || email)
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '·'
  );
}

export function TopbarFrame({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <header className="h-14 shrink-0 border-b border-line flex items-center justify-between px-4 bg-surface">
      {left}
      {right}
    </header>
  );
}
