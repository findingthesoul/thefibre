import Link from 'next/link';
import { appName, type AppId } from '@thefibre/shared';
import { apiFetch } from '@/lib/api';
import { VERSION } from '@/lib/version';
import {
  PageContainer,
  Breadcrumb,
  PageHeader,
  SectionLabel,
  EmptyState,
} from '@/components/ui/page';
import { BuildingDiagram, WallDiagram, BadgeDiagram, Caption } from './diagrams';
import { RulesTable, KeyRoutesTable, Glossary } from './reference';

export const metadata = {
  title: 'How The Fibre works',
};

type Me = {
  workspace: { name: string; slug: string; plan: string; created_at: string } | null;
  memberships: { app: { slug: string; name: string }; role: string }[];
};

type AppRef = { slug: string; name: string };
type WorkspaceApp = { deactivated_at: string | null; app: AppRef | AppRef[] | null };

function appOf(w: WorkspaceApp): AppRef | null {
  if (!w.app) return null;
  return Array.isArray(w.app) ? w.app[0] ?? null : w.app;
}

// Mirrors APP_SCOPES in apps/api/src/lib/app-keys.ts.
const SCOPES = [
  'read:persons',
  'write:persons',
  'read:organisations',
  'write:organisations',
  'read:activities',
  'write:activities',
  'write:curator_data',
  'read:flows',
  'write:flow_runs',
];

const CONNECT_STEPS: { who: string; what: string; then: string }[] = [
  {
    who: 'The app',
    what: 'Applies to be listed, describing itself, what it wants to do and what it will record.',
    then: 'Waiting — it can do nothing at all yet.',
  },
  {
    who: 'A Fibre admin',
    what: 'Reads that application in the app registry and approves or rejects it.',
    then: 'Approved — installable, but not installed anywhere.',
  },
  {
    who: 'A workspace admin',
    what: 'Switches it on for this workspace, on the same toggle as any of our own apps.',
    then: 'Active here, and nowhere else.',
  },
  {
    who: 'The app',
    what: 'Installs its application form, which is what creates the matching rules and the kinds of event it may log.',
    then: 'Ready to match records.',
  },
  {
    who: 'A workspace admin',
    what: 'Issues a key, ticking the permissions it should carry — only ones the application form asked for.',
    then: 'Shown once and never again. We keep a fingerprint, not the key.',
  },
];

export default async function AboutFibrePage() {
  let me: Me | null = null;
  let workspaceApps: WorkspaceApp[] = [];
  let planName: string | null = null;

  try {
    me = await apiFetch<Me>('/api/v1/auth/me');
  } catch {
    me = null;
  }
  try {
    // The real plan. me.workspace.plan is the legacy text column, which is
    // ignored by everything that matters — showing it here kept it looking
    // alive (docs/productisation-proposal.md §3.2).
    const p = await apiFetch<{ plan: { name: string } }>('/api/v1/plan');
    planName = p.plan.name;
  } catch {
    planName = null;
  }
  try {
    const r = await apiFetch<{ items: WorkspaceApp[] }>('/api/v1/workspace-apps');
    workspaceApps = r.items.filter((w) => !w.deactivated_at);
  } catch {
    workspaceApps = [];
  }

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="How The Fibre works"
        description="What this platform holds, what each app holds, and what anything built on top of it is allowed to reach."
      />

      {/* ---------------------------------------------------------- */}
      <section className="mt-10">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-4 rounded-lg border border-line bg-surface-raised p-5 text-sm md:grid-cols-4">
          <Fact label="Version" value={`v${VERSION}`} mono />
          <Fact label="Workspace" value={me?.workspace?.name ?? '—'} />
          <Fact label="Plan" value={planName ?? '—'} />
          <Fact label="Apps switched on" value={String(workspaceApps.length)} />
          <Fact label="Data lives in" value="Ireland (EU)" />
          <Fact label="Served from" value="Frankfurt (EU)" />
          <Fact label="Deletion" value="Marked, never scrubbed" />
          <Fact label="The logbook" value="Add-only, forever" />
        </dl>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>In plain words</SectionLabel>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-ink-subtle">
          <p>
            Think of a shared building. The Fibre is the front desk: it keeps the register of who
            everyone is, who knows whom, and a logbook of what happened and when. Meet, Thread, Flow
            and Pulse are four businesses with offices in that building, and each keeps its own
            files in its own office.
          </p>
          <p>
            The offices have no connecting doors. If two of them need to know the same thing, that
            thing either belongs at the front desk, or it goes through one of exactly three openings
            in the wall. There are three, they are named, and adding a fourth is a conversation
            rather than something anyone can just do.
          </p>
        </div>
        <BuildingDiagram />
        <Caption>
          Four apps that each keep their own files, one front desk that keeps the register, and one
          door for everybody else.
        </Caption>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>Why so little is written down</SectionLabel>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-ink-subtle">
          <p>
            Nothing is recorded about a person unless a specific app needs it for a specific reason.
            There is no general &ldquo;notes&rdquo; box quietly filling up with whatever. If nobody can name
            the app that needs a piece of information, it does not get stored.
          </p>
          <p>
            A pleasant side effect: a contact&rsquo;s page grows its own tabs, one for each app that
            actually holds something about them. Nobody sets those up. They appear because the
            information does, and they go when it goes.
          </p>
          <p>
            The logbook is deliberately thin. It records <em>that</em> something happened and a
            one-line title &mdash; &ldquo;attended the Athens session&rdquo; &mdash; and never the contents. Not what
            was said, not what was written, not the attachment. The thinness is the point: it makes
            leaking between apps impossible rather than merely frowned upon. It also cannot be
            edited afterwards; a mistake is corrected by adding a new line, never by rewriting the
            old one.
          </p>
        </div>
        <WallDiagram />
        <Caption>
          Three openings, each a deliberate decision. Everything else is the wall.
        </Caption>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Apps switched on in this workspace</SectionLabel>
          <Link
            href="/settings/apps"
            className="text-xs text-ink-subtle underline underline-offset-2 hover:text-ink"
          >
            Manage apps &rarr;
          </Link>
        </div>
        {workspaceApps.length === 0 ? (
          <EmptyState>
            Nothing switched on yet, or we couldn&rsquo;t reach the API just now.
          </EmptyState>
        ) : (
          <ul className="mt-4 flex flex-wrap gap-2">
            {workspaceApps.map((w) => {
              const a = appOf(w);
              if (!a) return null;
              return (
                <li
                  key={a.slug}
                  className="rounded-full border border-line bg-surface-raised px-3 py-1 text-xs"
                >
                  {appName(a.slug as AppId) ?? a.name}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-muted">
          Each of these has an office in the building. Switching one off closes the office; it does
          not delete what is at the front desk.
        </p>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>Apps built by other people</SectionLabel>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-ink-subtle">
          <p>
            Sometimes software written by someone else, running on their computers, needs to work
            with your register. The old way &mdash; the way the first one really worked &mdash; was to hand
            that software a colleague&rsquo;s own sign-in. It reached everything that person could reach,
            in every workspace they belonged to, and it stopped working the moment they signed out.
          </p>
          <p>
            Now an outside app gets a badge of its own. The badge says which app it belongs to and
            which workspace it is for, and on the back is a short list of exactly what it may do. It
            works at three in the morning. If it misbehaves you cancel that one badge and nobody
            else is affected. And anything not on the list is refused &mdash; the rule is not
            &ldquo;everything except what we blocked&rdquo; but &ldquo;nothing except what we listed&rdquo;, so something
            somebody forgot to add stays shut rather than swinging open.
          </p>
        </div>
        <BadgeDiagram />
        <Caption>
          Same app, same work to do. The only thing that changed is how much it can touch when
          nobody is watching.
        </Caption>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>How one gets connected</SectionLabel>
        <p className="mt-3 text-sm text-ink-subtle">
          Five steps, and three different people have to say yes. That is on purpose.
        </p>
        <ol className="mt-4 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface-raised">
          {CONNECT_STEPS.map((s, i) => (
            <li key={i} className="flex gap-4 px-5 py-4">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-xs text-ink-muted">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] uppercase tracking-wider text-ink-muted">{s.who}</div>
                <div className="mt-1 text-sm">{s.what}</div>
                <div className="mt-1 text-xs text-ink-muted">{s.then}</div>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-ink-muted">
          Cancelling a key, switching the app off here, or suspending it everywhere all take effect
          on its very next request. There is no delay to wait out.
        </p>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>What a key can reach &mdash; the whole list</SectionLabel>
        <p className="mt-3 text-sm text-ink-subtle">
          This is all of it. Anything not on this list is refused, whatever permissions the key
          carries. In particular, the ordinary contacts, organisations and Flow screens are not
          reachable with a key at all &mdash; those run as a signed-in person, and a key is not one.
        </p>
        <KeyRoutesTable />

        <div className="mt-6">
          <SectionLabel>The permissions a badge can carry</SectionLabel>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SCOPES.map((s) => (
              <li
                key={s}
                className="rounded-full border border-line bg-surface-raised px-3 py-1 font-mono text-xs"
              >
                {s}
              </li>
            ))}
            <li className="rounded-full border border-red-600/40 bg-red-500/5 px-3 py-1 font-mono text-xs text-red-700 line-through dark:border-red-400/40 dark:text-red-400">
              write:flows
            </li>
          </ul>
          <p className="mt-3 text-xs text-ink-muted">
            There is deliberately no permission to <em>design</em> a process. An outside app can run
            one of ours; the steps and the gates stay with the people in Flow.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>The rules, and what actually enforces them</SectionLabel>
        <p className="mt-3 text-sm text-ink-subtle">
          A rule that lives only in a document decays at the speed of memory. Each of these was
          given something that enforces it, so forgetting produces an error rather than a quiet
          drift.
        </p>
        <RulesTable />
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>Why it is built this way</SectionLabel>
        <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-subtle">
          <Bullet>
            Holding a lot of personal information used to look like an advantage. It is now mostly a
            risk. The cheapest way to satisfy the rules is to build something that <em>cannot</em> break
            them &mdash; and that is very hard to add afterwards.
          </Bullet>
          <Bullet>
            More and more software runs by itself, overnight, with nobody watching. Handing
            unattended software a person&rsquo;s own credentials is a bad idea in a way it simply was not
            when a human was clicking the button.
          </Bullet>
          <Bullet>
            Someone always wants to plug something in. Far better to settle the rules before the
            first one arrives than to inherit whatever that first one happened to do.
          </Bullet>
        </ul>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>And what it costs</SectionLabel>
        <ul className="mt-3 space-y-3 text-sm leading-relaxed text-ink-subtle">
          <Bullet muted>
            It is slower. Every new piece of information needs someone to say which app needs it and
            why.
          </Bullet>
          <Bullet muted>
            The most natural-sounding requests are the hardest. &ldquo;One screen showing everything we
            know about this person&rdquo; is exactly what the wall between the offices exists to prevent.
          </Bullet>
          <Bullet muted>
            Outside apps have more work to do. They keep their own records plus a matching list of
            our reference numbers, and since we never call them, they have to keep checking back.
          </Bullet>
          <Bullet muted>
            Getting connected needs three separate people to say yes, which today is mostly one
            small team.
          </Bullet>
          <Bullet muted>
            Once something is published to outside apps it can never be taken away again. Only added
            to.
          </Bullet>
        </ul>
        <p className="mt-5 rounded-lg border border-line bg-surface-sunken p-4 text-sm leading-relaxed text-ink-subtle">
          <span className="font-medium text-ink">The trade, in one line.</span> Pay in friction now,
          or pay later in a tangle nobody can safely undo. So far the evidence sits with paying now
          &mdash; but it is a bet, not a proof.
        </p>
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14">
        <SectionLabel>The words this page uses</SectionLabel>
        <Glossary />
      </section>

      {/* ---------------------------------------------------------- */}
      <section className="mt-14 border-t border-line pt-6">
        <SectionLabel>If you are building on this</SectionLabel>
        <p className="mt-3 text-sm text-ink-subtle">
          The full contract lives in the repository, at{' '}
          <code className="font-mono text-xs">docs/building-on-the-fibre.md</code>. It is the
          document to read before writing a line of integration code, and{' '}
          <code className="font-mono text-xs">apps/api/scripts/verify-external-app.mjs</code> is the
          runnable version of everything it claims.
        </p>
      </section>
    </PageContainer>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-muted">{label}</dt>
      <dd className={`mt-1 ${mono ? 'font-mono text-xs' : 'text-sm'}`}>{value}</dd>
    </div>
  );
}

function Bullet({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li className="relative pl-6">
      <span
        className={`absolute left-0 top-[0.5em] h-1.5 w-1.5 rounded-full ${
          muted ? 'bg-ink-muted' : 'bg-ink-subtle'
        }`}
      />
      {children}
    </li>
  );
}
