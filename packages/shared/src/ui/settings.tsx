// THE settings index — one shape, five apps.
//
// Sjoerd, 2026-09-01: "the settings should be the same in the whole app
// environment (fibre, thread, etc.). Otherwise it is mystery meat."
//
// He is describing something real. Before this, Profile sat under "Personal"
// in three apps and under "Profile" in The Fibre; Payments meant your own
// Stripe account in one place and the workspace's in another; Flow had no
// settings page at all; and the entries that only exist in The Fibre gave no
// clue that clicking them left the app. Same words, different meanings, no
// warning — which is exactly what mystery meat is.
//
// So the structure lives here, not in five page files:
//
//   You            things about you, the same in every app
//   Workspace      things about the organisation, the same in every app
//   <This app>     the part that genuinely differs
//   The Fibre      how it works, and privacy
//
// The order never changes, so muscle memory survives moving between apps, and
// an entry that lives in The Fibre says so on its face rather than teleporting
// you somewhere unannounced.
//
// Server-renderable — no hooks, no 'use client'. `link` is next/link, injected
// so this package keeps no Next.js dependency (same arrangement as HelpPage).
// The locale is an explicit parameter (i18n P3) — useLocale() cannot reach a
// server-renderable module; strings live in chrome-server-i18n.ts.

import type { ReactNode } from 'react';
import { ChevronRight, ExternalLink , Coins } from 'lucide-react';
import { DEFAULT_LOCALE, type Locale } from '../i18n.js';
import { serverChromeT, type ServerChromeKey } from './chrome-server-i18n.js';

/** next/link, structurally. See HelpLink in help.tsx for why it is loose. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SettingsLink = (props: { href: string; className?: string; children?: any }) => any;

export type SettingsEntry = {
  href?: string;
  /** An icon element, e.g. <Users size={17} strokeWidth={1.75} />. */
  icon: ReactNode;
  title: string;
  desc: string;
  /** Lives in another app — says so, and opens there. */
  external?: boolean;
  /** Present but not available (no permission, or not built yet). */
  disabled?: boolean;
  /** Why it is disabled. Shown instead of the description. */
  disabledReason?: string;
};

export type SettingsSection = {
  label: string;
  entries: SettingsEntry[];
};

/** The four headings, in the order they always appear. "The Fibre" is brand. */
export const SETTINGS_SECTIONS = {
  you: 'You',
  workspace: 'Workspace',
  platform: 'The Fibre',
} as const;

export function SettingsCards({
  sections,
  link: Link,
  locale = DEFAULT_LOCALE,
}: {
  sections: SettingsSection[];
  link: SettingsLink;
  locale?: Locale;
}) {
  return (
    <>
      {sections
        .filter((s) => s.entries.length > 0)
        .map((section) => (
          <section key={section.label} className="mt-10">
            <div className="text-[10px] uppercase tracking-wider text-ink-muted">
              {section.label}
            </div>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {section.entries.map((entry) => (
                <SettingsCard key={entry.title} entry={entry} link={Link} locale={locale} />
              ))}
            </div>
          </section>
        ))}
    </>
  );
}

function SettingsCard({
  entry,
  link: Link,
  locale,
}: {
  entry: SettingsEntry;
  link: SettingsLink;
  locale: Locale;
}) {
  const unavailable = entry.disabled || !entry.href;
  const body = (
    <div
      className={`flex h-full items-start gap-3.5 rounded-lg border border-line bg-surface-raised p-4 transition-colors ${
        unavailable ? 'opacity-50' : 'hover:border-line-strong'
      }`}
    >
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-surface-sunken ring-1 ring-line shrink-0 text-ink-subtle">
        {entry.icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">
          {entry.title}
          {entry.external && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-ink-muted">
              {serverChromeT(locale, 'in_the_fibre')}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-ink-subtle leading-relaxed">
          {unavailable && entry.disabledReason ? entry.disabledReason : entry.desc}
        </p>
      </div>
      {!unavailable &&
        (entry.external ? (
          <ExternalLink size={14} strokeWidth={1.75} className="text-ink-muted shrink-0 mt-1" />
        ) : (
          <ChevronRight size={16} strokeWidth={1.75} className="text-ink-muted shrink-0 mt-1" />
        ))}
    </div>
  );

  if (unavailable || !entry.href) return <div>{body}</div>;
  return (
    <Link href={entry.href} className="block">
      {body}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// The canonical entries.
//
// Defined once so that "Profile" means the same thing, sits in the same
// section and carries the same description in all five apps. An app says which
// of them it serves itself; everything else points into The Fibre and is
// labelled as doing so.
// ---------------------------------------------------------------------------

import {
  User,
  Cable,
  CreditCard,
  Building2,
  Users,
  LayoutGrid,
  Receipt,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';

export type PlatformSettingKey =
  | 'profile'
  | 'connections'
  | 'payments'
  | 'workspace'
  | 'members'
  | 'apps'
  | 'currencies'
  | 'plan'
  | 'about'
  | 'privacy';

const ICON = { size: 17, strokeWidth: 1.75 } as const;

const CANON: Record<
  PlatformSettingKey,
  { section: 'you' | 'workspace' | 'platform'; title: string; desc: string; icon: ReactNode; path: string }
> = {
  profile: {
    section: 'you',
    title: 'Profile',
    desc: 'Your name, photo, bio and timezone. Every app shows this one.',
    icon: <User {...ICON} />,
    path: '/settings/profile',
  },
  connections: {
    section: 'you',
    title: 'Connections',
    desc: 'Your calendar and your personal meeting room — connected once, used by every app.',
    icon: <Cable {...ICON} />,
    path: '/settings/connections',
  },
  payments: {
    section: 'you',
    title: 'Payments',
    desc: 'Where your money arrives: your Stripe account and the workspace’s.',
    icon: <CreditCard {...ICON} />,
    path: '/settings/payments',
  },
  workspace: {
    section: 'workspace',
    title: 'Workspace',
    desc: 'Its name, logo, invoice details and the sender of its email.',
    icon: <Building2 {...ICON} />,
    path: '/settings/workspace',
  },
  members: {
    section: 'workspace',
    title: 'Members',
    desc: 'Who is in the workspace, what they may do, and which apps they can use.',
    icon: <Users {...ICON} />,
    path: '/settings/members',
  },
  apps: {
    section: 'workspace',
    title: 'Apps',
    desc: 'Which apps this workspace uses, and the keys that let your own software in.',
    icon: <LayoutGrid {...ICON} />,
    path: '/settings/apps',
  },
  currencies: {
    section: 'workspace',
    title: 'Currencies',
    desc: 'Which currencies this workspace sells in, and the default — one list for everything priced.',
    icon: <Coins {...ICON} />,
    path: '/settings/currencies',
  },
  plan: {
    section: 'workspace',
    title: 'Plan',
    desc: 'What this workspace is on, and what it is using.',
    icon: <Receipt {...ICON} />,
    path: '/settings/plan',
  },
  about: {
    section: 'platform',
    title: 'How The Fibre works',
    desc: 'The data wall, what each app owns, and why it is built this way.',
    icon: <BookOpen {...ICON} />,
    path: '/settings/about',
  },
  privacy: {
    section: 'platform',
    title: 'Privacy',
    desc: 'Consents, your data, and asking for it to be removed.',
    icon: <ShieldCheck {...ICON} />,
    path: '/privacy',
  },
};

/**
 * The three shared sections, ready to render.
 *
 * `hosted` lists the keys this app serves itself. Everything else becomes a
 * link into The Fibre, marked "in The Fibre" — the alternative is a card that
 * silently changes domain, which is the mystery meat this exists to remove.
 *
 * `omit` drops entries an app genuinely has no business showing.
 */
export function platformSettings({
  fibreUrl,
  hosted = [],
  omit = [],
  appSection,
  locale = DEFAULT_LOCALE,
}: {
  fibreUrl: string;
  hosted?: PlatformSettingKey[];
  omit?: PlatformSettingKey[];
  /** This app's own settings, shown between Workspace and The Fibre. */
  appSection?: SettingsSection;
  /** The signed-in interface language (i18n P3) — pass `await uiLocale()`. */
  locale?: Locale;
}): SettingsSection[] {
  const pick = (section: 'you' | 'workspace' | 'platform') =>
    (Object.keys(CANON) as PlatformSettingKey[])
      .filter((k) => CANON[k].section === section && !omit.includes(k))
      .map((k) => {
        const c = CANON[k];
        const isLocal = hosted.includes(k);
        return {
          href: isLocal ? c.path : `${fibreUrl}${c.path}`,
          icon: c.icon,
          title: serverChromeT(locale, `st_${k}_title` as ServerChromeKey),
          desc: serverChromeT(locale, `st_${k}_desc` as ServerChromeKey),
          ...(isLocal ? {} : { external: true }),
        } satisfies SettingsEntry;
      });

  return [
    { label: serverChromeT(locale, 'section_you'), entries: pick('you') },
    { label: serverChromeT(locale, 'section_workspace'), entries: pick('workspace') },
    ...(appSection ? [appSection] : []),
    // "The Fibre" heading is the brand name — the same in every language.
    { label: SETTINGS_SECTIONS.platform, entries: pick('platform') },
  ];
}
