import type { ModelDefinition } from '../engine';
import { DOAB } from './doab';

// A blank model: one recurring revenue stream, one fixed cost, one
// investment line — enough to see every panel and start replacing.
export const BLANK: ModelDefinition = {
  name: 'New business model',
  tagline: '',
  description: 'Describe the venture in one or two sentences.',
  currency: 'EUR',
  currencySymbol: '€',
  horizon: 36,
  breakEvenMonth: 12,
  unitLabel: 'customers',
  canvas: { keyPartners: [], keyActivities: [], keyResources: [], valuePropositions: [], customerRelationships: [], channels: [] },
  settings: [{ id: 'procFee', label: 'Payment processing fee', unit: '% of revenue', value: 2, step: 0.1 }],
  genericVariable: [{ id: 'procFee', label: 'Payment processing', kind: 'percentRevenue' }],
  generators: [
    {
      id: 'subscription',
      name: 'Subscriptions',
      short: 'Subscriptions',
      segment: 'Customers who pay per month',
      help: 'A recurring fee per customer per month.',
      inputs: [
        { id: 'fee', label: 'Monthly fee', unit: 'EUR / customer', value: 25, step: 1 },
        { id: 'start', label: 'Customers in month one', unit: 'customers', value: 20, step: 5 },
        { id: 'growth', label: 'Monthly growth', unit: '%', value: 10, step: 0.5 },
        { id: 'churn', label: 'Monthly churn', unit: '%', value: 3, step: 0.5 },
      ],
      volume: { start: 'start', growth: 'growth', churn: 'churn' },
      revenuePerUnit: 'fee',
      costs: [
        { id: 'cOnboard', label: 'Onboarding', unit: 'EUR / new customer', kind: 'perNewUnit', value: 10, step: 1 },
        { id: 'cServe', label: 'Service cost', unit: 'EUR / customer / month', kind: 'perUnit', value: 4, step: 0.5 },
      ],
    },
  ],
  fixedCosts: [
    { id: 'team', label: 'Team', value: 6000, step: 250 },
    { id: 'software', label: 'Software and hosting', value: 300, step: 25 },
  ],
  investment: [{ id: 'build', label: 'Product build before launch', value: 10000, step: 500 }],
};

export const TEMPLATES: { id: string; name: string; blurb: string; definition: ModelDefinition }[] = [
  { id: 'blank', name: 'Blank', blurb: 'One revenue stream, one fixed cost, one investment. Replace everything.', definition: BLANK },
  { id: 'doab', name: 'doáb.ai', blurb: 'A cooperative of doers and builders: memberships, a marketplace, consulting and grants.', definition: DOAB },
];
