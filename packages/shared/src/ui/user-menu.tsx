'use client';

// The avatar menu (extraction phase 3). One implementation for all six apps;
// the app-bound pieces are INJECTED: onSavePref (server action), onSignOut
// (supabase + navigation), onSwitchWorkspace (token refresh + navigation),
// onSidebarChanged (router.refresh so the server layout re-reads the cookie).
// Flow-style apps hide the Profile item (profileHref: null) and point
// Settings at the platform.

import { useEffect, useRef, useState, useTransition } from 'react';
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
import { COOKIE_THEME, COOKIE_SIDEBAR, type SidebarMode, type Theme } from '../prefs.js';
import { chromeT, useLocale } from './i18n-ui.js';

export type WorkspaceChoice = { id: string; name: string | null; is_active: boolean };

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function UserMenu({
  email,
  fullName,
  initials,
  theme: initialTheme,
  sidebar: initialSidebar,
  workspaces = [],
  profileHref = '/settings/profile',
  settingsHref = '/settings',
  onSavePref,
  onSidebarChanged,
  onSwitchWorkspace,
  onSignOut,
}: {
  email: string;
  fullName: string;
  initials: string;
  theme: Theme;
  sidebar: SidebarMode;
  /** Empty or single-entry when this person belongs to one workspace, which is
   *  most of them — the section hides itself rather than showing a choice of
   *  one. */
  workspaces?: WorkspaceChoice[];
  /** null hides the Profile item (Flow: profile lives on the platform). */
  profileHref?: string | null;
  settingsHref?: string;
  /** The app's savePref server action — domain-wide cookie, dodges Safari's
   *  7-day ITP cap on document.cookie writes. */
  onSavePref: (key: string, value: string) => Promise<void>;
  /** Called after the sidebar pref persists — typically router.refresh(). */
  onSidebarChanged: () => void;
  /** Does EVERYTHING app-side: record choice, refresh the session token,
   *  navigate home, refresh. Resolve with {error} to keep the menu open. */
  onSwitchWorkspace?: (id: string) => Promise<{ error?: string } | void>;
  onSignOut: () => Promise<void>;
}) {
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [sidebar, setSidebar] = useState<SidebarMode>(initialSidebar);
  const [, startTransition] = useTransition();
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
    void onSavePref(COOKIE_THEME, t);
  }

  function pickSidebar(s: SidebarMode) {
    setSidebar(s);
    // Persist server-side first, then refresh so the server layout re-reads it.
    startTransition(async () => {
      await onSavePref(COOKIE_SIDEBAR, s);
      onSidebarChanged();
    });
  }

  const [switching, setSwitching] = useState<string | null>(null);

  function pickWorkspace(id: string) {
    if (switching || !onSwitchWorkspace) return;
    setSwitching(id);
    startTransition(async () => {
      const result = await onSwitchWorkspace(id);
      setSwitching(null);
      if (result && result.error) return;
      setOpen(false);
    });
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
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              {chromeT(locale, 'signed_in')}
            </div>
            <div className="font-medium mt-1">{fullName}</div>
            <div className="text-ink-subtle">{email}</div>
          </div>

          <Divider />
          {profileHref && (
            <Item
              icon={UserIcon}
              label={chromeT(locale, 'profile')}
              href={profileHref}
              onClick={() => setOpen(false)}
            />
          )}
          <Item
            icon={Settings}
            label={chromeT(locale, 'settings')}
            href={settingsHref}
            onClick={() => setOpen(false)}
          />
          {/* "Take a tour" stays as a dead placeholder until the tour exists. */}
          <Item icon={Compass} label={chromeT(locale, 'take_tour')} disabled />

          {onSwitchWorkspace && workspaces.length > 1 && (
            <>
              <Divider />
              <SectionLabel>{chromeT(locale, 'workspace')}</SectionLabel>
              {workspaces.map((w) => (
                <Option
                  key={w.id}
                  icon={Building2}
                  label={
                    switching === w.id
                      ? chromeT(locale, 'switching')
                      : w.name ?? chromeT(locale, 'untitled_workspace')
                  }
                  active={w.is_active}
                  onClick={() => pickWorkspace(w.id)}
                />
              ))}
            </>
          )}

          <Divider />
          <SectionLabel>{chromeT(locale, 'sidebar')}</SectionLabel>
          <Option icon={PanelLeftOpen} label={chromeT(locale, 'sidebar_expanded')} active={sidebar === 'expanded'} onClick={() => pickSidebar('expanded')} />
          <Option icon={PanelLeftClose} label={chromeT(locale, 'sidebar_collapsed')} active={sidebar === 'collapsed'} onClick={() => pickSidebar('collapsed')} />
          <Option icon={Sparkles} label={chromeT(locale, 'sidebar_hover')} active={sidebar === 'hover'} onClick={() => pickSidebar('hover')} />

          <Divider />
          <SectionLabel>{chromeT(locale, 'theme')}</SectionLabel>
          <Option icon={Sun} label={chromeT(locale, 'theme_light')} active={theme === 'light'} onClick={() => pickTheme('light')} />
          <Option icon={Moon} label={chromeT(locale, 'theme_dark')} active={theme === 'dark'} onClick={() => pickTheme('dark')} />
          <Option icon={MonitorCog} label={chromeT(locale, 'theme_system')} active={theme === 'system'} onClick={() => pickTheme('system')} />

          <Divider />
          <button
            onClick={() => void onSignOut()}
            className="w-full text-left px-3 py-2 flex items-center gap-2.5 hover:bg-surface-sunken text-ink-subtle hover:text-ink"
          >
            <LogOut size={16} strokeWidth={1.75} />
            {chromeT(locale, 'sign_out')}
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
