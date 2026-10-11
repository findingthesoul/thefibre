// The "Zoom is still waiting for approval" notice, once, for every app that
// shows a Zoom Connect button.
//
// Sjoerd, 2026-10-12: *"for zoom - as long as it is not connected... make a
// comment at the connect button for all usr (except me), that this is still
// under request, and they should use GOOOGLE or the personal zoom room link
// at thre botom."*
//
// Three apps draw that button — Meet, Thread and The Fibre — and all three
// already share one card (ui/provider-connection.tsx). The strings are shared
// too rather than copied into three catalogues, which is what a sentence in
// six locales turns into otherwise: eighteen strings that drift.
//
// ── REMOVE WHEN THE ZOOM MARKETPLACE APP IS PUBLISHED ──────────────────────
//
// This whole file goes, along with ZOOM_MARKETPLACE_PENDING in
// apps/api/src/lib/zoom-pending.ts and the `notice` prop on the card. The
// flag in the API is the switch; this is only the wording.

import type { Locale } from './index.js';

type Entry = Record<Locale, string>;

const COPY: Record<string, Entry> = {
  // Deliberately says what to do, not only what is wrong. A notice that
  // reports a problem and stops leaves somebody with a meeting to run.
  pending: {
    en: 'Zoom is still waiting for approval from Zoom itself, so connecting may not work yet. Use Google Meet instead, or paste your personal Zoom room link in the field further down this page.',
    nl: 'Zoom wacht nog op goedkeuring van Zoom zelf, dus verbinden werkt mogelijk nog niet. Gebruik zolang Google Meet, of plak de link van je persoonlijke Zoom-ruimte in het veld verderop op deze pagina.',
    es: 'Zoom todavía espera la aprobación del propio Zoom, así que conectar puede no funcionar aún. Usa Google Meet mientras tanto, o pega el enlace de tu sala personal de Zoom en el campo más abajo en esta página.', // MT
    pt: 'O Zoom ainda aguarda aprovação do próprio Zoom, por isso ligar pode ainda não funcionar. Usa o Google Meet entretanto, ou cola o link da tua sala pessoal do Zoom no campo mais abaixo nesta página.', // MT
    de: 'Zoom wartet noch auf die Freigabe durch Zoom selbst, das Verbinden funktioniert also möglicherweise noch nicht. Nutze so lange Google Meet, oder füge den Link deines persönlichen Zoom-Raums in das Feld weiter unten auf dieser Seite ein.', // MT
    fr: 'Zoom attend encore l’approbation de Zoom lui-même, la connexion peut donc ne pas encore fonctionner. Utilise Google Meet en attendant, ou colle le lien de ta salle Zoom personnelle dans le champ plus bas sur cette page.', // MT
  },
};

export function zoomPendingNotice(locale: Locale): string {
  return COPY.pending![locale];
}
