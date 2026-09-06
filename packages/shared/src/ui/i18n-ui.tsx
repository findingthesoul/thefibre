'use client';

// The shared chrome's i18n (i18n P3, Sjoerd 2026-09-06: "P3 for all 6
// languages"). Two things live here:
//
// 1. LocaleProvider / useLocale — how CLIENT components learn the signed-in
//    user's interface language. Each app's (app)/layout.tsx reads the
//    thefibre.locale cookie server-side (lib/locale.ts → uiLocale()) and
//    wraps the shell in <LocaleProvider locale={…}>. Components outside a
//    provider (public pages) fall back to English — a public page that
//    wants localized shared chrome may wrap its own provider with the
//    CONTENT language.
//
// 2. The CHROME catalog — every user-facing string inside the shared
//    components (user-menu, sidebar, bottom-nav, dialogs, invoices area,
//    profile form, …), in ALL six locales. Same rule as every catalog: a
//    missing locale fails typecheck; es/pt/de/fr machine-drafted lines
//    carry `// MT` for native review, NL is written to native quality and
//    reviewed by Sjoerd.
//
// App-specific strings do NOT belong here — they live in the app's own
// lib/i18n-ui.ts. This catalog is only for strings rendered by
// packages/shared/src/ui components.

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, makeT, type I18nEntry, type Locale } from '../i18n.js';

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

/** The signed-in interface language; DEFAULT_LOCALE outside a provider. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}

const CHROME = {
  // ── shell ────────────────────────────────────────────────────────────
  help: {
    en: 'Help',
    nl: 'Help',
    es: 'Ayuda', // MT
    pt: 'Ajuda', // MT
    de: 'Hilfe', // MT
    fr: 'Aide', // MT
  },
  more: {
    en: 'More',
    nl: 'Meer',
    es: 'Más', // MT
    pt: 'Mais', // MT
    de: 'Mehr', // MT
    fr: 'Plus', // MT
  },
  menu: {
    en: 'Menu',
    nl: 'Menu',
    es: 'Menú', // MT
    pt: 'Menu', // MT
    de: 'Menü', // MT
    fr: 'Menu', // MT
  },
  close: {
    en: 'Close',
    nl: 'Sluiten',
    es: 'Cerrar', // MT
    pt: 'Fechar', // MT
    de: 'Schließen', // MT
    fr: 'Fermer', // MT
  },
} satisfies Record<string, I18nEntry>;

export const chromeT = makeT(CHROME);
export type ChromeKey = keyof typeof CHROME;
