/**
 * Diagrams for Settings → How The Fibre works.
 *
 * Hand-authored inline SVG — no library, no runtime. Everything is drawn with
 * the app's own tokens (surface / ink / line) so both themes come for free;
 * amber is the one meaning-colour, reserved for "something outside the
 * building", and red for "this is refused".
 *
 * Coordinates are on a deliberate grid. If you move a box, move its label.
 */

const BOX = 'fill-surface-raised stroke-line';
const BOX_EMPHASIS = 'fill-surface-raised stroke-line-strong';
const BOX_AMBER = 'fill-amber-500/10 stroke-amber-600 dark:stroke-amber-400';
const BOX_RED = 'fill-red-500/10 stroke-red-600 dark:stroke-red-400';
const T_AMBER = 'fill-amber-700 dark:fill-amber-400';
const T_RED = 'fill-red-700 dark:fill-red-400';
const LINE = 'stroke-ink-subtle fill-none';
const LINE_SOFT = 'stroke-line fill-none';
const LINE_AMBER = 'stroke-amber-600 dark:stroke-amber-400 fill-none';

function Frame({
  label,
  viewBox,
  children,
}: {
  label: string;
  viewBox: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-4 rounded-lg border border-line bg-surface-raised overflow-x-auto">
      <div className="p-5">
        <svg
          viewBox={viewBox}
          role="img"
          aria-label={label}
          className="block h-auto w-full min-w-[720px]"
        >
          {children}
        </svg>
      </div>
    </div>
  );
}

export function Caption({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 text-xs text-ink-muted">{children}</p>;
}

/* ------------------------------------------------------------------ */
/* 1. The building                                                     */
/* ------------------------------------------------------------------ */

export function BuildingDiagram() {
  return (
    <Frame
      viewBox="0 0 1040 420"
      label="The Fibre as a front desk holding the register of people, with four tools around it, and an outside app reaching in through a single door using its own badge."
    >
      <defs>
        <marker id="ab-b-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-ink-subtle" />
        </marker>
        <marker id="ab-b-amb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-amber-600 dark:fill-amber-400" />
        </marker>
      </defs>

      <rect x="36" y="44" width="660" height="340" rx="14" className={LINE_SOFT} strokeWidth={1.5} strokeDasharray="7 6" />
      <text x="56" y="70" className="fill-ink-muted text-[11px] uppercase tracking-[0.14em]">
        Inside — your workspace
      </text>

      <rect x="216" y="170" width="300" height="120" rx="8" className={BOX_EMPHASIS} strokeWidth={2} />
      <text x="366" y="196" textAnchor="middle" className="fill-ink text-[13px] font-semibold">the front desk</text>
      <text x="366" y="220" textAnchor="middle" className="fill-ink-subtle text-[11px]">who each person is</text>
      <text x="366" y="238" textAnchor="middle" className="fill-ink-subtle text-[11px]">who knows whom</text>
      <text x="366" y="256" textAnchor="middle" className="fill-ink-subtle text-[11px]">what happened, one line at a time</text>
      <text x="366" y="274" textAnchor="middle" className="fill-ink-subtle text-[11px]">who agreed to what</text>

      <rect x="60" y="92" width="160" height="52" rx="6" className={BOX} strokeWidth={1.5} />
      <rect x="476" y="92" width="160" height="52" rx="6" className={BOX} strokeWidth={1.5} />
      <rect x="60" y="308" width="160" height="52" rx="6" className={BOX} strokeWidth={1.5} />
      <rect x="476" y="308" width="160" height="52" rx="6" className={BOX} strokeWidth={1.5} />
      <text x="140" y="114" textAnchor="middle" className="fill-ink text-[12px] font-medium">Meet</text>
      <text x="140" y="132" textAnchor="middle" className="fill-ink-muted text-[11px]">meetings</text>
      <text x="556" y="114" textAnchor="middle" className="fill-ink text-[12px] font-medium">Thread</text>
      <text x="556" y="132" textAnchor="middle" className="fill-ink-muted text-[11px]">programmes</text>
      <text x="140" y="330" textAnchor="middle" className="fill-ink text-[12px] font-medium">Flow</text>
      <text x="140" y="348" textAnchor="middle" className="fill-ink-muted text-[11px]">processes</text>
      <text x="556" y="330" textAnchor="middle" className="fill-ink text-[12px] font-medium">Pulse</text>
      <text x="556" y="348" textAnchor="middle" className="fill-ink-muted text-[11px]">planning</text>

      <line x1="140" y1="146" x2="238" y2="168" className={LINE} strokeWidth={1.5} markerStart="url(#ab-b-ink)" markerEnd="url(#ab-b-ink)" />
      <line x1="556" y1="146" x2="494" y2="168" className={LINE} strokeWidth={1.5} markerStart="url(#ab-b-ink)" markerEnd="url(#ab-b-ink)" />
      <line x1="140" y1="306" x2="238" y2="292" className={LINE} strokeWidth={1.5} markerStart="url(#ab-b-ink)" markerEnd="url(#ab-b-ink)" />
      <line x1="556" y1="306" x2="494" y2="292" className={LINE} strokeWidth={1.5} markerStart="url(#ab-b-ink)" markerEnd="url(#ab-b-ink)" />

      <rect x="684" y="232" width="24" height="56" rx="4" className={BOX_EMPHASIS} strokeWidth={2} />
      <line x1="754" y1="260" x2="714" y2="260" className={LINE_AMBER} strokeWidth={1.5} markerEnd="url(#ab-b-amb)" />
      <line x1="682" y1="260" x2="522" y2="252" className={LINE_AMBER} strokeWidth={1.5} markerEnd="url(#ab-b-amb)" />

      <rect x="756" y="92" width="248" height="72" rx="8" className={BOX_AMBER} strokeWidth={1.5} />
      <text x="880" y="118" textAnchor="middle" className={`${T_AMBER} text-[13px] font-semibold`}>an outside app</text>
      <text x="880" y="138" textAnchor="middle" className="fill-ink-subtle text-[11px]">someone else&rsquo;s software,</text>
      <text x="880" y="156" textAnchor="middle" className="fill-ink-subtle text-[11px]">on their computers</text>
      <line x1="880" y1="164" x2="880" y2="190" className={LINE_AMBER} strokeWidth={1.5} markerEnd="url(#ab-b-amb)" />
      <rect x="756" y="196" width="248" height="88" rx="8" className={BOX_AMBER} strokeWidth={1.5} />
      <text x="880" y="222" textAnchor="middle" className={`${T_AMBER} text-[12px] font-medium`}>carrying its own badge</text>
      <text x="880" y="242" textAnchor="middle" className="fill-ink-subtle text-[11px]">this workspace only,</text>
      <text x="880" y="260" textAnchor="middle" className="fill-ink-subtle text-[11px]">a short list of doors,</text>
      <text x="880" y="278" textAnchor="middle" className="fill-ink-subtle text-[11px]">works with nobody watching</text>

      <text x="756" y="318" className="fill-ink-muted text-[11px]">it may ask about people it has already</text>
      <text x="756" y="336" className="fill-ink-muted text-[11px]">matched, and add one line to the logbook.</text>
      <text x="756" y="354" className="fill-ink-muted text-[11px]">Nothing else, ever.</text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 2. The data wall                                                    */
/* ------------------------------------------------------------------ */

export function WallDiagram() {
  return (
    <Frame
      viewBox="0 0 1040 524"
      label="A wall separates platform-owned data from app-owned data, pierced by exactly three gates: activity, the purchase ledger, and flow definitions. Everything else stops at the wall."
    >
      <defs>
        <marker id="ab-w-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" className="fill-ink-subtle" />
        </marker>
      </defs>

      <text x="36" y="34" className="fill-ink text-[13px] font-semibold">The Fibre owns</text>
      <line x1="36" y1="46" x2="300" y2="46" className={LINE_SOFT} strokeWidth={1.5} />
      <text x="1004" y="34" textAnchor="end" className="fill-ink text-[13px] font-semibold">Each app owns</text>
      <line x1="740" y1="46" x2="1004" y2="46" className={LINE_SOFT} strokeWidth={1.5} />

      <text x="36" y="80" className="fill-ink-subtle text-[12px]">people and organisations</text>
      <text x="36" y="102" className="fill-ink-subtle text-[12px]">users, workspaces, teams</text>
      <text x="36" y="124" className="fill-ink-subtle text-[12px]">who is connected to whom</text>
      <text x="36" y="146" className="fill-ink-subtle text-[12px]">the logbook of what happened</text>
      <text x="36" y="168" className="fill-ink-subtle text-[12px]">who is enrolled in what</text>
      <text x="36" y="190" className="fill-ink-subtle text-[12px]">consent</text>
      <text x="36" y="212" className="fill-ink-subtle text-[12px]">the app catalogue and its keys</text>

      <text x="1004" y="80" textAnchor="end" className="fill-ink-subtle text-[12px]">its own content</text>
      <text x="1004" y="102" textAnchor="end" className="fill-ink-muted text-[11px]">its own files, in its own office</text>
      <text x="1004" y="146" textAnchor="end" className="fill-ink-subtle text-[12px]">the extra fields it justified</text>
      <text x="1004" y="168" textAnchor="end" className="fill-ink-muted text-[11px]">each one labelled with the app that keeps it</text>
      <text x="1004" y="190" textAnchor="end" className="fill-ink-muted text-[11px]">you see only the apps you belong to</text>
      <text x="1004" y="212" textAnchor="end" className="fill-ink-muted text-[11px]">&mdash; so a profile tab appears when data does</text>

      <g className="fill-ink-muted/40 stroke-ink-muted" strokeWidth={1.5}>
        <rect x="478" y="36" width="44" height="68" />
        <rect x="478" y="160" width="44" height="52" />
        <rect x="478" y="268" width="44" height="52" />
        <rect x="478" y="376" width="44" height="58" />
      </g>

      <line x1="330" y1="132" x2="668" y2="132" className={LINE} strokeWidth={1.5} markerEnd="url(#ab-w-ink)" />
      <line x1="330" y1="240" x2="668" y2="240" className={LINE} strokeWidth={1.5} markerEnd="url(#ab-w-ink)" />
      <line x1="330" y1="348" x2="668" y2="348" className={LINE} strokeWidth={1.5} markerEnd="url(#ab-w-ink)" />

      <rect x="370" y="108" width="260" height="48" rx="8" className={BOX} strokeWidth={1.5} />
      <rect x="370" y="216" width="260" height="48" rx="8" className={BOX} strokeWidth={1.5} />
      <rect x="370" y="324" width="260" height="48" rx="8" className={BOX} strokeWidth={1.5} />

      <text x="500" y="130" textAnchor="middle" className="fill-ink text-[13px] font-semibold">the logbook</text>
      <text x="500" y="148" textAnchor="middle" className="fill-ink-muted text-[11px]">what happened, and one line about it</text>
      <text x="500" y="238" textAnchor="middle" className="fill-ink text-[13px] font-semibold">money</text>
      <text x="500" y="256" textAnchor="middle" className="fill-ink-muted text-[11px]">what was bought, for how much, by whom</text>
      <text x="500" y="346" textAnchor="middle" className="fill-ink text-[13px] font-semibold">the shape of a process</text>
      <text x="500" y="364" textAnchor="middle" className="fill-ink-muted text-[11px]">steps and task templates, never a run</text>

      <rect x="36" y="452" width="968" height="56" rx="8" className={BOX_RED} strokeWidth={1.5} />
      <text x="56" y="478" className={`${T_RED} text-[12px]`}>
        Everything else stops at the wall — contents, attachments, a helpful join.
      </text>
      <text x="56" y="498" className={`${T_RED} text-[11px]`}>
        A fourth opening is a conversation to have, not something anyone can add.
      </text>
    </Frame>
  );
}

/* ------------------------------------------------------------------ */
/* 3. The badge                                                        */
/* ------------------------------------------------------------------ */

const REACH_CELLS = [
  '/persons',
  '/organisations',
  '/activities',
  '/programmes',
  '/flow',
  '/meet',
  '/thread',
  '/pulse',
  '/apps/:slug',
  '/workspace',
  '/invoices',
  '/admin',
];
// Only these two are reachable with an app key. The rest need a signed-in person.
const KEY_REACHABLE = new Set(['/activities', '/apps/:slug']);

function cellPos(i: number, originX: number) {
  return { x: originX + (i % 4) * 116, y: 164 + Math.floor(i / 4) * 34 };
}

export function BadgeDiagram() {
  return (
    <Frame
      viewBox="0 0 1040 380"
      label="A borrowed staff sign-in reaches every route that person can reach; an app key reaches only the logbook and the app-facing routes."
    >
      <text x="24" y="34" className={`${T_RED} text-[13px] font-semibold`}>
        Before — a borrowed staff sign-in
      </text>
      <text x="24" y="52" className="fill-ink-muted text-[11px]">how the first real integration actually worked</text>
      <line x1="24" y1="62" x2="478" y2="62" className={LINE_SOFT} strokeWidth={1.5} />
      <text x="528" y="34" className="fill-ink text-[13px] font-semibold">After — the app&rsquo;s own badge</text>
      <text x="528" y="52" className="fill-ink-muted text-[11px]">one app, one workspace</text>
      <line x1="528" y1="62" x2="982" y2="62" className={LINE_SOFT} strokeWidth={1.5} />

      <rect x="24" y="80" width="150" height="40" rx="6" className={BOX} strokeWidth={1.5} />
      <text x="99" y="105" textAnchor="middle" className="fill-ink text-[12px]">Outside app</text>
      <rect x="190" y="80" width="288" height="40" rx="6" className={BOX_RED} strokeWidth={1.5} />
      <text x="334" y="105" textAnchor="middle" className={`${T_RED} text-[12px]`}>a person&rsquo;s own sign-in</text>

      <rect x="528" y="80" width="150" height="40" rx="6" className={BOX} strokeWidth={1.5} />
      <text x="603" y="105" textAnchor="middle" className="fill-ink text-[12px]">Outside app</text>
      <rect x="694" y="80" width="288" height="40" rx="6" className={BOX_AMBER} strokeWidth={1.5} />
      <text x="838" y="105" textAnchor="middle" className={`${T_AMBER} text-[12px] font-mono`}>fibre_ak_&hellip;</text>

      <text x="24" y="152" className="fill-ink-muted text-[11px] uppercase tracking-[0.14em]">What that reaches</text>
      <text x="528" y="152" className="fill-ink-muted text-[11px] uppercase tracking-[0.14em]">What that reaches</text>

      {REACH_CELLS.map((label, i) => {
        const { x, y } = cellPos(i, 24);
        return (
          <g key={`l-${label}`}>
            <rect x={x} y={y} width={106} height={26} rx={5} className={BOX_RED} strokeWidth={1.5} />
            <text x={x + 53} y={y + 17} textAnchor="middle" className={`${T_RED} text-[10px] font-mono`}>
              {label}
            </text>
          </g>
        );
      })}

      {REACH_CELLS.map((label, i) => {
        const { x, y } = cellPos(i, 528);
        const on = KEY_REACHABLE.has(label);
        return (
          <g key={`r-${label}`}>
            <rect
              x={x}
              y={y}
              width={106}
              height={26}
              rx={5}
              className={on ? BOX_AMBER : 'fill-none stroke-line'}
              strokeWidth={on ? 1.5 : 1.2}
              strokeDasharray={on ? undefined : '4 4'}
            />
            <text
              x={x + 53}
              y={y + 17}
              textAnchor="middle"
              className={`text-[10px] font-mono ${on ? T_AMBER : 'fill-ink-muted opacity-45'}`}
            >
              {label}
            </text>
          </g>
        );
      })}

      <text x="24" y="292" className={`${T_RED} text-[11px]`}>everything the person can reach, in every workspace they are in</text>
      <text x="24" y="312" className={`${T_RED} text-[11px]`}>dies with their session — so no overnight syncing at all</text>
      <text x="24" y="332" className={`${T_RED} text-[11px]`}>revoking it means signing that person out</text>
      <text x="528" y="292" className="fill-ink-subtle text-[11px]">one app, one workspace, a named list of routes</text>
      <text x="528" y="312" className="fill-ink-subtle text-[11px]">no person behind it — so it can run unattended</text>
      <text x="528" y="332" className="fill-ink-subtle text-[11px]">revocable on its own, effective on the next request</text>

      <line x1="503" y1="24" x2="503" y2="344" className={LINE_SOFT} strokeWidth={1.5} />
    </Frame>
  );
}
