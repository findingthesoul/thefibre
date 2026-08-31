'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  User as UserIcon,
  Settings,
  Compass,
  Sun,
  Moon,
  MonitorCog,
  PanelLeftOpen,
  PanelLeftClose,
  Sparkles,
  LogOut,
  Check,
  Building2,
} from 'lucide-react';
import { browserSupabase } from '@/lib/supabase/client';
import {
  COOKIE_THEME,
  COOKIE_SIDEBAR,
  type SidebarMode,
  type Theme,
} from '@/lib/prefs-shared';
import { savePref } from '@/lib/prefs-actions';
import { switchWorkspace } from '@/lib/workspace-actions';

export type WorkspaceChoice = { id: string; name: string | null; is_active: boolean };

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function UserMenu({
  email,
  fullName,
  initials,
  theme: initialTheme,
  sidebar: initialSidebar,
  workspaces = [],
}: {
  email: string;
  fullName: string;
  initials: string;
  theme: Theme;
  sidebar: SidebarMode;
  /** Only the ones this app can actually be used in; see the layout. */
  workspaces?: WorkspaceChoice[];
}) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [sidebar, setSidebar] = useState<SidebarMode>(initialSidebar);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Live-respond to system theme changes when theme=system.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  function pickTheme(t: Theme) {
    setTheme(t);
    applyTheme(t); // instant visual; cookie persists server-side
    void savePref(COOKIE_THEME, t);
  }

  function pickSidebar(s: SidebarMode) {
    setSidebar(s);
    // Persist server-side first, then refresh so the server layout re-reads it.
    startTransition(async () => {
      await savePref(COOKIE_SIDEBAR, s);
      router.refresh();
    });
  }

  const [switching, setSwitching] = useState<string | null>(null);

  function pickWorkspace(id: string) {
    if (switching) return;
    setSwitching(id);
    startTransition(async () => {
      const result = await switchWorkspace(id);
      if (result.error) {
        setSwitching(null);
        return;
      }
      // The workspace lives in the token, so recording the choice changes
      // nothing until a new token is issued. refreshSession() re-runs the
      // access-token hook, which stamps the workspace we just chose.
      await browserSupabase().auth.refreshSession();
      // Home, not here: whatever is on screen belongs to the workspace being
      // left, and a record id from one tenant is nothing in another. Refresh
      // after, so the server components re-read with the new token.
      router.replace('/dashboard');
      router.refresh();
      setSwitching(null);
      setOpen(false);
    });
  }

  async function signOut() {
    await browserSupabase().auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-ink-subtle text-xs font-medium hover:text-ink ring-1 ring-line"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {initials}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 rounded-lg bg-surface-raised border border-line shadow-lg py-2 text-sm">
          <div className="px-3 py-2">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">Signed in</div>
            <div className="font-medium mt-1">{fullName}</div>
            <div className="text-ink-subtle">{email}</div>
          </div>

          <Divider />
          <Item icon={UserIcon} label="Profile" href="/settings/profile" onClick={() => setOpen(false)} />
          <Item icon={Settings} label="Settings" href="/settings" onClick={() => setOpen(false)} />
          {/* "Take a tour" stays as a dead placeholder until the tour exists. */}
          <Item icon={Compass} label="Take a tour" disabled />

          {workspaces.length > 1 && (
            <>
              <Divider />
              <SectionLabel>Workspace</SectionLabel>
              {workspaces.map((w) => (
                <Option
                  key={w.id}
                  icon={Building2}
                  label={switching === w.id ? 'Switching…' : w.name ?? 'Untitled workspace'}
                  active={w.is_active}
                  onClick={() => pickWorkspace(w.id)}
                />
              ))}
            </>
          )}

          <Divider />
          <SectionLabel>Sidebar</SectionLabel>
          <Option icon={PanelLeftOpen} label="Expanded" active={sidebar === 'expanded'} onClick={() => pickSidebar('expanded')} />
          <Option icon={PanelLeftClose} label="Collapsed" active={sidebar === 'collapsed'} onClick={() => pickSidebar('collapsed')} />
          <Option icon={Sparkles} label="Expand on hover" active={sidebar === 'hover'} onClick={() => pickSidebar('hover')} />

          <Divider />
          <SectionLabel>Theme</SectionLabel>
          <Option icon={Sun} label="Light" active={theme === 'light'} onClick={() => pickTheme('light')} />
          <Option icon={Moon} label="Dark" active={theme === 'dark'} onClick={() => pickTheme('dark')} />
          <Option icon={MonitorCog} label="System" active={theme === 'system'} onClick={() => pickTheme('system')} />

          <Divider />
          <button
            onClick={signOut}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-surface-sunken text-ink-subtle hover:text-ink"
          >
            <LogOut size={16} strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="my-1 border-t border-line" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-1 pb-1 text-[10px] uppercase tracking-wider text-ink-muted">
      {children}
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  href,
  onClick,
  disabled,
}: {
  icon: typeof UserIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const className =
    'w-full text-left px-3 py-2 flex items-center gap-2.5 ' +
    (disabled
      ? 'text-ink-muted cursor-not-allowed opacity-60'
      : 'text-ink-subtle hover:text-ink hover:bg-surface-sunken');
  const inner = (
    <>
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </>
  );
  if (href && !disabled) {
    return (
      <a href={href} onClick={onClick} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

function Option({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof UserIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-3 py-1.5 flex items-center gap-2.5 hover:bg-surface-sunken text-ink-subtle hover:text-ink"
    >
      <span className="w-4 inline-flex justify-center">
        {active && <Check size={14} strokeWidth={2.25} className="text-ink" />}
      </span>
      <Icon size={16} strokeWidth={1.75} />
      {label}
    </button>
  );
}
