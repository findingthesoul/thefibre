// Re-export shim. The fallen line moved to @thefibre/shared/ui/marks on
// 2026-09-24, when the public site themes became its second caller. Edit the
// shared copy.
//
// The old signature carried `begin`/`end` from the days when the line drew
// itself on scroll; call sites still pass them. They are accepted and
// ignored here rather than in the shared component, so the shared one has no
// dead parameters — if a drawn-on-scroll variant is ever wanted again, bring
// back lib/scroll's useScrollProgress.
import { DrawnThread as SharedDrawnThread } from '@thefibre/shared/ui/marks';

export function DrawnThread({
  begin: _begin,
  end: _end,
  ...rest
}: {
  d: string;
  viewBox: string;
  className?: string;
  begin?: number;
  end?: number;
  strokeWidth?: number;
}) {
  return <SharedDrawnThread {...rest} />;
}
