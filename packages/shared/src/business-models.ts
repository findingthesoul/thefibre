// Business Models — the definition contract in words, one complete example,
// and the prompt that turns a story into a definition. ONE copy, read by the
// app (the "New business model" dialog shows the prompt), by the MCP server
// (models_schema hands the guide to an assistant; a prompt carries the
// method), and by whoever writes a definition by hand.
//
// The engine that consumes a definition is apps/models/lib/engine.ts; if the
// format grows, grow it here in the same commit.

export const MODEL_FORMAT: readonly string[] = [
  'A definition is one JSON object. Top level: name, tagline, description, currency (e.g. "EUR"), currencySymbol (e.g. "€"), horizon (months, 12–120, default 36), breakEvenMonth (the reference month for blended rates, default 12), unitLabel (plural, e.g. "members" or "customers"), canvas, settings, genericVariable, generators, fixedCosts, investment.',
  'canvas: { keyPartners, keyActivities, keyResources, valuePropositions, customerRelationships, channels }, each an array of short lines in the venture’s own words. A value proposition may be { text, segments: ["<generator id>", …] } to say which segments it serves.',
  'settings: [{ id, label, unit, value, step }] — global numbers every formula may use by id (e.g. a payment fee percentage).',
  'genericVariable: [{ id: "<a settings id>", label, kind }] — costs on all revenue; kind is percentRevenue, perUnit or perNewUnit.',
  'generators: the turnover generators, one per way money comes in. Each: { id, name, short, segment (one line: who this is), help, countsAsUnit (default true), inputs: [{ id, label, unit, value, step }], volume, revenuePerUnit or revenueTotal, costs }.',
  'volume for a segment: { start: "<input id>", growth: "<input id>", churn: "<input id>" } — units start at start, then each month × (1 + growth% − churn%). Optional add, cap, startMonth. A derived stream: { linkedTo: "<generator id>", factor: 1 } takes that generator’s units.',
  'revenuePerUnit: a formula string over the generator’s input ids and settings ids, e.g. "fee" or "vol * take / 100". Lump income (a grant, a sponsorship): countsAsUnit false, volume { start: 1, startMonth: "from" }, revenueTotal: "amount".',
  'costs: [{ id, label, unit, kind, value, step, batchSize? }] — the costs that exist only because of this generator; kind is perUnit, perNewUnit, perBatch (with batchSize, a formula), percentRevenue, fixed or formula (with formula).',
  'fixedCosts: [{ id, label, value, step }] per month (the key resources: team, software, rent, legal, marketing). investment: [{ id, label, value, step }] one-off before month one.',
  'Formulas are plain arithmetic over ids: + - * / ( ) and numbers, plus month, units, newUnits, revenue, batches. Nothing else.',
  'Every number is a placeholder. Choose plausible values and say in help texts what they mean; never present them as the venture’s real figures. Ids are short, unique, lowercase.',
];

export const MODEL_EXAMPLE = {
  name: 'Example studio',
  tagline: 'A small studio with members and workshops',
  description: 'Members pay monthly; workshops sell seats to the same people.',
  currency: 'EUR',
  currencySymbol: '€',
  horizon: 36,
  breakEvenMonth: 12,
  unitLabel: 'members',
  canvas: {
    keyPartners: ['The venue that hosts the workshops'],
    keyActivities: ['Weekly community evening', 'Monthly workshop'],
    keyResources: ['Two part-time facilitators', 'The studio space'],
    valuePropositions: [{ text: 'A place to practise every week, with people who keep you going', segments: ['members'] }],
    customerRelationships: ['Personal onboarding call', 'Members recommend members'],
    channels: ['Open evenings', 'Word of mouth'],
  },
  settings: [{ id: 'procFee', label: 'Payment processing fee', unit: '% of revenue', value: 2, step: 0.1 }],
  genericVariable: [{ id: 'procFee', label: 'Payment processing', kind: 'percentRevenue' }],
  generators: [
    {
      id: 'members',
      name: 'Members',
      short: 'Members',
      segment: 'People who practise weekly',
      help: 'A monthly membership.',
      inputs: [
        { id: 'fee', label: 'Monthly fee', unit: 'EUR / member', value: 40, step: 5 },
        { id: 'start', label: 'Members in month one', unit: 'members', value: 30, step: 5 },
        { id: 'growth', label: 'Monthly growth', unit: '%', value: 8, step: 0.5 },
        { id: 'churn', label: 'Monthly churn', unit: '%', value: 3, step: 0.5 },
      ],
      volume: { start: 'start', growth: 'growth', churn: 'churn' },
      revenuePerUnit: 'fee',
      costs: [
        { id: 'cOnboard', label: 'Onboarding call', unit: 'EUR / new member', kind: 'perNewUnit', value: 15, step: 1 },
        { id: 'cCare', label: 'Materials', unit: 'EUR / member / month', kind: 'perUnit', value: 3, step: 0.5 },
      ],
    },
    {
      id: 'workshops',
      name: 'Workshops',
      short: 'Workshops',
      help: 'Seats sold to members, one workshop a month.',
      volume: { linkedTo: 'members', factor: 0.3 },
      inputs: [{ id: 'price', label: 'Seat price', unit: 'EUR / seat', value: 60, step: 5 }],
      revenuePerUnit: 'price',
      costs: [{ id: 'cRoom', label: 'Room and facilitator', unit: 'EUR / workshop', kind: 'perBatch', batchSize: 12, value: 300, step: 25 }],
    },
  ],
  fixedCosts: [
    { id: 'team', label: 'Facilitators', value: 3000, step: 100 },
    { id: 'rent', label: 'Studio rent', value: 900, step: 50 },
  ],
  investment: [{ id: 'setup', label: 'Furnishing the studio', value: 6000, step: 500 }],
} as const;

export const MODEL_SCHEMA_GUIDE = { format: MODEL_FORMAT, example: MODEL_EXAMPLE } as const;

/** The questions an assistant asks before it writes a first version — only
 *  the ones the story leaves open; placeholders for the rest, said so. */
export const MODEL_QUESTIONS: readonly string[] = [
  'Who pays? Each customer segment or revenue stream, in one line each. Roughly how many of each in month one, and how they grow and leave per month (in %).',
  'What does each pay, and how often? A monthly fee, a price per sale, a share of a transaction, a seat, a grant amount.',
  'Which costs exist only because of a stream: delivery, onboarding per new customer, facilitation per group, a payout share, payment fees.',
  'The fixed monthly costs: team, software, rent, legal, marketing.',
  'The one-off investment before month one: formation, product build, launch.',
  'The currency, the horizon in months (36 is usual), and the word for a unit (members, customers, orders).',
  'For the canvas: key partners, key activities, key resources, value propositions per segment, how customers are won and kept, channels — a few lines each, in the venture’s own words.',
];

/** The prompt a person gives an assistant, with or without the story pasted
 *  underneath. Used verbatim by the app's dialog and by the MCP prompt. */
export function storyPromptText(story?: string, name?: string): string {
  return [
    `Turn the story below into a business model definition for the Business Models app in The Fibre${name ? `, called "${name}"` : ''}. Work in this order.`,
    '',
    '1. Read the story. List the turnover generators you see (every way money comes in), the segments that pay, the costs that belong to each generator, the generic fixed costs, and the investment.',
    '2. Ask me, in ONE message, only the questions the story leaves open. Do not ask what it already answers. The things a model needs:',
    ...MODEL_QUESTIONS.map((q) => `   - ${q}`),
    '   Where I do not know, propose a plausible placeholder and mark it as yours.',
    '3. After my answers, produce ONE JSON object in the format below, and nothing after it. Every number is a placeholder; say what each means in its help text.',
    '4. I paste it into Business Models → New business model → "Paste a definition (JSON)", or you create it with models_create if you are connected through The Fibre.',
    '',
    'The format:',
    ...MODEL_FORMAT.map((line) => `- ${line}`),
    '',
    'A complete small example, to copy the shape from:',
    JSON.stringify(MODEL_EXAMPLE, null, 2),
    '',
    'The story:',
    (story ?? '').trim() || '(paste the story here)',
  ].join('\n');
}
