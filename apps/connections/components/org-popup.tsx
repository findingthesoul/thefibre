'use client';

// An organisation, in a popup, from anywhere — and a way to say who belongs
// to it without leaving the page you are on.
//
// Sjoerd, 2026-09-13: *"It would be great of I could also open an
// organisation, and connect a person too it (in the popup)"*.
//
// This is person-popup.tsx's sibling and deliberately the same shape: one
// provider at the layout, `openOrg(id)` from anywhere, back closes it. The
// reasoning for each of those decisions is written out in that file and is
// not repeated here — what differs is written down below.
//
// ── What differs from the person popup ─────────────────────────────────────
//
//   * There is no full page to fall through to. Connections has no
//     /organisations/:id route, so this popup is the whole surface rather
//     than a fast path to one, and there is no "open the full page" link
//     promising something that does not exist.
//   * It WRITES. The person popup opens onto a composer that was already
//     built; connecting somebody here is a new fact recorded from inside a
//     dialog, so the list has to update underneath without a page reload or
//     the person you just added appears to have vanished.
//
// ── Connecting a person is a choice from a list, never a typed name ────────
//
// Handbook §12: attach a person by their identifier. The field searches the
// workspace's own people and hands over an id; there is no way to type a name
// that does not resolve to somebody, because a name in prose is a hint and a
// membership is a fact. Same rule the @mention picker follows, and it reads
// the same vocabulary endpoint.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Dialog } from '@thefibre/shared/ui/dialog';
import { t, type Locale } from '@/lib/i18n-ui';
import { usePersonPopup } from '@/components/person-popup';
import { loadOrg, connectPerson, type OrgCard, type OrgMember } from '@/app/(app)/organisations/actions';
import { fetchVocabulary } from '@/app/(app)/people/[id]/actions';

type Ctx = { openOrg: (id: string) => void };

const OrgPopupContext = createContext<Ctx | null>(null);

export function useOrgPopup(): Ctx {
  const ctx = useContext(OrgPopupContext);
  // No provider means no popup to open. Unlike a person there is no page to
  // fall back to, so the honest degradation is to do nothing rather than
  // navigate somewhere that would 404.
  return ctx ?? { openOrg: () => {} };
}

const memberName = (m: OrgMember): string => {
  const p = m.person;
  if (!p) return '—';
  return [p.first_name, p.last_name].filter(Boolean).join(' ').trim() || p.email || p.id.slice(0, 8);
};

export function OrgPopupProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: Locale;
}) {
  const [id, setId] = useState<string | null>(null);
  const [org, setOrg] = useState<OrgCard | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (orgId: string) => {
    setLoading(true);
    setError(null);
    // Caught here as well as inside loadOrg: that function never throws from
    // its own code, but the CALL is a network request to a server action and
    // that can fail on its own. Without this the popup would sit on "Loading"
    // forever with no error and no way out — the exact bug the person popup
    // had, found by a test that made the call itself reject.
    let r: Awaited<ReturnType<typeof loadOrg>>;
    try {
      r = await loadOrg(orgId);
    } catch (e) {
      r = { ok: false, error: e instanceof Error ? e.message : 'unknown error' };
    }
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    setOrg(r.organisation);
    setMembers(r.members);
  }, []);

  // Back closes the popup — see person-popup.tsx for why this is one exit
  // path through popstate rather than two that have to be kept in step.
  const pushed = useRef(false);

  const clear = useCallback(() => {
    setId(null);
    setOrg(null);
    setMembers([]);
    setError(null);
  }, []);

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      clear();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [clear]);

  const openOrg = useCallback(
    (orgId: string) => {
      if (!pushed.current) {
        window.history.pushState({ orgPopup: true }, '');
        pushed.current = true;
      }
      setId(orgId);
      setOrg(null);
      setMembers([]);
      void load(orgId);
    },
    [load],
  );

  const close = useCallback(() => {
    if (pushed.current) window.history.back();
    else clear();
  }, [clear]);

  /**
   * A new membership, folded into the list already on screen.
   *
   * Re-reading the organisation would be simpler and is what this did first;
   * it is wrong because the popup would flash empty while the round trip ran,
   * on top of the round trip that wrote the row. The added person is known —
   * their id and name came from the picker — so the list can say so at once
   * and stay correct.
   */
  const added = useCallback((personId: string, name: string, title: string) => {
    setMembers((prev) => [
      ...prev,
      {
        // Not a real membership id: the row exists, but its id was not
        // returned to this component. Nothing here needs it — ending a
        // membership is not a thing this popup does — and inventing a
        // plausible uuid would be worse than a key that is obviously local.
        id: `new:${personId}`,
        title: title.trim() || null,
        is_primary: false,
        person: { id: personId, first_name: name, last_name: null, email: null },
      },
    ]);
  }, []);

  return (
    <OrgPopupContext.Provider value={{ openOrg }}>
      {children}

      {id && (
        <Dialog
          open
          onClose={close}
          title={org?.name || (error ? t(locale, 'map_org_title') : t(locale, 'loading'))}
          size="lg"
        >
          {error && (
            <p className="text-sm text-ink">
              {t(locale, 'org_load_failed')} {error}
            </p>
          )}

          {loading && !org && <p className="text-sm text-ink-muted">{t(locale, 'loading')}</p>}

          {org && (
            <div className="space-y-6">
              <section>
                <h3 className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
                  {t(locale, 'org_members')}
                </h3>
                {members.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-muted">{t(locale, 'org_no_members')}</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {members.map((m) => (
                      <li key={m.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <MemberName member={m} />
                        {m.title && <span className="text-xs text-ink-muted">{m.title}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <ConnectPerson orgId={org.id} locale={locale} onAdded={added} existing={members} />
            </div>
          )}
        </Dialog>
      )}
    </OrgPopupContext.Provider>
  );
}

/**
 * A name in the list, which opens that person over this organisation.
 *
 * A person with no id — which should not happen, but the API's shape allows
 * it — is drawn as plain text rather than as a button that would do nothing.
 */
function MemberName({ member }: { member: OrgMember }) {
  const { openPerson } = usePersonPopup();
  const id = member.person?.id;
  if (!id) return <span>{memberName(member)}</span>;
  return (
    <button type="button" onClick={() => openPerson(id)} className="text-left hover:underline">
      {memberName(member)}
    </button>
  );
}

/**
 * Say that somebody belongs here.
 *
 * The people come from the same vocabulary endpoint the @mention picker
 * reads, so there is one answer to "who does this workspace know" rather than
 * two that can disagree. Loaded when the popup opens rather than on the first
 * keystroke: it is one small request, and a picker that pauses before its
 * first result reads as broken.
 */
function ConnectPerson({
  orgId,
  locale,
  onAdded,
  existing,
}: {
  orgId: string;
  locale: Locale;
  onAdded: (personId: string, name: string, title: string) => void;
  existing: OrgMember[];
}) {
  const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
  const [term, setTerm] = useState('');
  const [chosen, setChosen] = useState<{ id: string; name: string } | null>(null);
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchVocabulary().then((v) => {
      if (alive) setPeople(v.people);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Anybody already on the list is not offered again. Adding a second live
  // membership for the same pair is not an error the API refuses, so the only
  // thing standing between a double-click and a duplicate row is this.
  const alreadyHere = useMemo(
    () => new Set(existing.map((m) => m.person?.id).filter(Boolean) as string[]),
    [existing],
  );

  const matches = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter((p) => !alreadyHere.has(p.id) && p.name.toLowerCase().includes(q))
      .slice(0, 8);
  }, [term, people, alreadyHere]);

  async function save() {
    if (!chosen) return;
    setSaving(true);
    setError(null);
    const r = await connectPerson(orgId, chosen.id, title);
    setSaving(false);
    if (!r.ok) {
      setError(r.error === 'forbidden' ? t(locale, 'org_connect_forbidden') : r.error);
      return;
    }
    onAdded(chosen.id, chosen.name, title);
    setChosen(null);
    setTerm('');
    setTitle('');
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }

  return (
    <section className="border-t border-line pt-4">
      <h3 className="text-xs font-medium uppercase tracking-wide text-ink-subtle">
        {t(locale, 'org_connect_title')}
      </h3>

      {chosen ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-full border border-line bg-surface-raised px-3 py-1">
              {chosen.name}
            </span>
            <button
              type="button"
              onClick={() => setChosen(null)}
              className="text-xs text-ink-muted hover:text-ink"
            >
              {t(locale, 'cancel')}
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(locale, 'org_connect_role')}
            maxLength={200}
            className="w-full rounded-md border border-line bg-surface py-2 px-3 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-8 items-center rounded-md border border-line bg-surface-raised px-3 text-sm hover:bg-surface-sunken disabled:opacity-50"
          >
            {saving ? t(locale, 'saving') : t(locale, 'org_connect_do')}
          </button>
        </div>
      ) : (
        <div className="mt-2">
          <div className="relative">
            <Search
              size={15}
              strokeWidth={1.75}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
            />
            <input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={t(locale, 'org_connect_search')}
              aria-label={t(locale, 'org_connect_search')}
              className="w-full rounded-md border border-line bg-surface-raised py-2 pl-9 pr-3 text-sm placeholder:text-ink-muted focus:border-line-strong focus:outline-none"
            />
          </div>
          {/* In the flow, not floating. A floating list opens into the
              bottom edge of the dialog and is clipped — which is exactly what
              happened the first time this shipped. Letting it take space
              instead makes the dialog grow, and the dialog already scrolls. */}
          {term.trim() && (
            <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-line bg-surface py-1">
              {matches.length === 0 ? (
                <li className="px-3 py-1.5 text-xs text-ink-muted">{t(locale, 'people_none')}</li>
              ) : (
                matches.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setChosen(p);
                        setTerm('');
                      }}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-surface-sunken"
                    >
                      {p.name}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      )}

      {done && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted">
          <Check size={13} /> {t(locale, 'saved')}
        </p>
      )}
      {error && <p className="mt-2 text-xs text-ink">{error}</p>}
    </section>
  );
}
