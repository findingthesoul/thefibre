// Catalogue of registered apps + their human labels and which profile-sub-resources
// (curator tables) they own. This is the single source of truth in the web layer
// for "what does each app contribute to a profile".
//
// Mirrors the brief v0.4 §3 + §14 mapping.

export type AppSlug =
  | 'fibre-platform'
  | 'fibre-suite'
  | 'the-thread'
  | 'fibre-sales'
  | 'fibre-learn';

export type AppDescriptor = {
  slug: AppSlug;
  label: string;
  /** Sub-resource paths under /persons/:id and /organisations/:id served by this app. */
  personSubResources: PersonSubResource[];
  orgSubResources: OrgSubResource[];
};

export type PersonSubResource = 'professional' | 'relationship' | 'change' | 'learning';
export type OrgSubResource = 'identity' | 'system-context' | 'relationship';

export const APPS: Record<AppSlug, AppDescriptor> = {
  'fibre-platform': {
    slug: 'fibre-platform',
    label: 'Fibre',
    personSubResources: ['professional'],
    orgSubResources: ['identity'],
  },
  'fibre-suite': {
    slug: 'fibre-suite',
    label: 'Fibre Suite',
    personSubResources: ['change'],
    orgSubResources: ['system-context'],
  },
  'the-thread': {
    slug: 'the-thread',
    label: 'The Thread',
    personSubResources: [],
    orgSubResources: [],
  },
  'fibre-sales': {
    slug: 'fibre-sales',
    label: 'Fibre Sales',
    personSubResources: ['relationship'],
    orgSubResources: ['relationship'],
  },
  'fibre-learn': {
    slug: 'fibre-learn',
    label: 'Fibre Learn',
    personSubResources: ['learning'],
    orgSubResources: [],
  },
};

export const APP_ORDER: AppSlug[] = [
  'fibre-platform',
  'fibre-suite',
  'the-thread',
  'fibre-sales',
  'fibre-learn',
];

export function isAppSlug(s: string): s is AppSlug {
  return s in APPS;
}
