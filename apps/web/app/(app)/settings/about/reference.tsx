/**
 * Reference tables for Settings → How The Fibre works.
 *
 * The route list mirrors APP_KEY_ROUTES in apps/api/src/middleware/app-context.ts
 * and the scope list mirrors APP_SCOPES in apps/api/src/lib/app-keys.ts. Those
 * two files are the source of truth — if you add a route or a scope there,
 * add it here too, or this page starts lying to people.
 */

import { Fragment, type ReactNode } from 'react';

export function Table({
  head,
  children,
}: {
  head: ReactNode[];
  children: ReactNode;
}) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-raised">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            {head.map((h, i) => (
              <th
                key={i}
                className="border-b border-line bg-surface-sunken px-4 py-2.5 text-left text-[10px] font-normal uppercase tracking-wider text-ink-muted"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

function Td({ children, mono = false }: { children: ReactNode; mono?: boolean }) {
  return (
    <td className={`px-4 py-3 align-top ${mono ? 'whitespace-nowrap font-mono text-xs' : 'text-ink-subtle'}`}>
      {children}
    </td>
  );
}

function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <tr>
      <td
        colSpan={span}
        className="bg-surface-sunken px-4 py-2 text-[10px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */

const RULES: [string, string, string][] = [
  [
    'No personal data leaves the EU',
    'The web app holds nothing; every operation on a person runs on the API in Frankfurt against a database in Ireland',
    'There is nothing on the front end to leak',
  ],
  [
    'A field exists because an app needs it',
    'Every extra field is labelled with the app that keeps it, and you only see the apps you belong to',
    'A field no app justifies is a field nobody can see',
  ],
  [
    'The logbook can never be rewritten',
    'Two database triggers refuse any edit or deletion outright',
    'The database refuses it before the software even notices',
  ],
  [
    'An app cannot get more than it asked for',
    'The list of permissions you can tick is built from the app’s own application form',
    'The box cannot be ticked',
  ],
  [
    'An app key cannot wander',
    'A short list of allowed routes, and everything not on it is refused',
    'Refused before the request reaches any code that could answer it',
  ],
  [
    'An app can only log the events it declared',
    'Checked against its application form as the event arrives',
    'Rejected, with the list it did declare in the reply',
  ],
  [
    'What outside apps rely on cannot change',
    'A verification script asserts the exact shape of every published response',
    'The verification run fails',
  ],
];

export function RulesTable() {
  return (
    <Table head={['The rule', 'What actually enforces it', 'How you find out you broke it']}>
      {RULES.map(([rule, mech, tell]) => (
        <tr key={rule}>
          <td className="px-4 py-3 align-top font-medium">{rule}</td>
          <Td>{mech}</Td>
          <Td>{tell}</Td>
        </tr>
      ))}
    </Table>
  );
}

/* ------------------------------------------------------------------ */

type Route = { route: string; scope: string; what: string };
const ROUTE_GROUPS: { group: string; rows: Route[] }[] = [
  {
    group: 'Matching up records',
    rows: [
      { route: 'POST /apps/:slug/links', scope: 'write:persons', what: 'Match one of its records to a person here' },
      { route: 'POST /apps/:slug/links:bulk', scope: 'write:persons', what: 'Up to 500 at once, each reporting its own result' },
      { route: 'GET /apps/:slug/links/:entity/:id', scope: 'read:persons', what: 'Read back a match it made' },
      { route: 'GET /apps/:slug/persons/:entity/:id', scope: 'read:persons', what: 'The match plus the person, in one go' },
      { route: 'GET /apps/:slug/organisations/:entity/:id', scope: 'read:organisations', what: 'The same, for an organisation' },
    ],
  },
  {
    group: 'The logbook',
    rows: [
      { route: 'POST /activities', scope: 'write:activities', what: 'Add a line. Only a kind of event it declared.' },
      { route: 'GET /activities', scope: 'read:activities', what: 'Read the log' },
    ],
  },
  {
    group: 'Flow — running a process it did not design',
    rows: [
      { route: 'GET /apps/:slug/flow/flows', scope: 'read:flows', what: 'Which processes can I run?' },
      { route: 'GET /apps/:slug/flow/flows/:id', scope: 'read:flows', what: 'The published shape: steps, tasks, sections' },
      { route: 'POST /apps/:slug/flow/flows/:id/runs', scope: 'write:flow_runs', what: 'Start a run; a retry returns the same one' },
      { route: 'GET /apps/:slug/flow/runs', scope: 'read:flows', what: 'Its own runs only — never anybody else’s' },
      { route: 'GET /apps/:slug/flow/runs/:id', scope: 'read:flows', what: 'Steps, tasks, notes and a derived status' },
      { route: 'POST /apps/:slug/flow/runs/:id/move', scope: 'write:flow_runs', what: 'Move a run to a step' },
      { route: 'POST /apps/:slug/flow/runs/:id/tasks', scope: 'write:flow_runs', what: 'Add a task of its own' },
      { route: 'PATCH /apps/:slug/flow/tasks/:id', scope: 'write:flow_runs', what: 'Tick it off, or back on' },
      { route: 'GET · PUT /apps/:slug/flow/runs/:id/steps/:key/note', scope: 'read:flows · write:flow_runs', what: 'One note per step, its own, rewritten in place' },
    ],
  },
  {
    group: 'Housekeeping',
    rows: [
      { route: 'GET · PUT /apps/:slug/manifest', scope: '—', what: 'Read back or install what it declared' },
      { route: 'GET /apps/whoami', scope: '—', what: 'Check the badge works and see what is on it' },
    ],
  },
];

export function KeyRoutesTable() {
  return (
    <Table head={['Route', 'Permission it costs', 'What it does']}>
      {ROUTE_GROUPS.map(({ group, rows }) => (
        <Fragment key={group}>
          <GroupRow label={group} span={3} />
          {rows.map((r) => (
            <tr key={r.route}>
              <Td mono>{r.route}</Td>
              <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-ink-muted">
                {r.scope}
              </td>
              <Td>{r.what}</Td>
            </tr>
          ))}
        </Fragment>
      ))}
    </Table>
  );
}

/* ------------------------------------------------------------------ */

const GLOSSARY: [string, string][] = [
  ['workspace', 'One organisation’s separate world inside Fibre. Nothing leaks between workspaces.'],
  ['the data wall', 'Who owns what. The Fibre owns identity and the logbook; each app owns its own files, and apps cannot read each other’s.'],
  ['activity', 'The logbook. That something happened, plus a one-line title. Never the contents.'],
  ['append-only', 'You can add a correction. You can never edit or erase what is already written.'],
  ['curator data', 'Extra facts one app keeps about a person, labelled with which app keeps them and why.'],
  ['app key', 'An outside app’s own badge. One app, one workspace, cancellable on its own.'],
  ['scope', 'One permission written on the back of that badge — "may add to the logbook" — and nothing implied beyond it.'],
  ['manifest', 'The app’s application form: what it wants to do, and what it promises to record. It can never later be given more than it asked for.'],
  ['default deny', 'Nothing opens unless it is on the list. A route somebody forgot to add stays shut.'],
  ['RLS', 'The database itself checks who is asking before it hands anything over — so a mistake in the software above it still cannot spill data.'],
  ['the contract', 'The published set of responses outside apps are written against. It can gain fields; it never loses or changes one.'],
  ['entity mapping', 'An outside app’s own reference number for a person, matched up with ours. Two lists, kept in step deliberately.'],
  ['soft delete', 'Marked as removed rather than scrubbed, so a deletion can still be explained and audited.'],
  ['in-family app', 'One of ours — Meet, Thread, Flow, Pulse. An office in the building rather than a visitor at the door.'],
];

export function Glossary() {
  return (
    <Table head={['The term', 'What it actually means']}>
      {GLOSSARY.map(([term, meaning]) => (
        <tr key={term}>
          <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-xs text-ink">{term}</td>
          <Td>{meaning}</Td>
        </tr>
      ))}
    </Table>
  );
}
