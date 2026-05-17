// Catalogue of registered apps + their human labels and which profile-sub-resources
// (curator tables) they own. This is the single source of truth in the web layer
// for "what does each app contribute to a profile".
//
// Mirrors the brief v0.4 §3 + §14 mapping.

export type AppSlug =
  | 'fibre-platform'
  | 'fibre-meet'
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

export type PersonSubResource = 'professional' | 'relationship' | 'change' | 'learning' | 'billing';
export type OrgSubResource = 'identity' | 'system-context' | 'relationship' | 'billing';

export const APPS: Record<AppSlug, AppDescriptor> = {
  'fibre-platform': {
    slug: 'fibre-platform',
    label: 'Fibre',
    personSubResources: ['professional'],
    orgSubResources: ['identity'],
  },
  'fibre-meet': {
    slug: 'fibre-meet',
    label: 'Fibre Meet',
    // No per-app sub-resources via SubResourceSection — the fibre-meet tab
    // renders its own bespoke layout (profile + upcoming + past meetings).
    // Change-context fields were removed v2.1.3 (they belong to a future
    // Fibre Change app, not Meet — see brief §5).
    personSubResources: [],
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
    personSubResources: ['relationship', 'billing'],
    orgSubResources: ['relationship', 'billing'],
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
  'fibre-meet',
  'the-thread',
  'fibre-sales',
  'fibre-learn',
];

export function isAppSlug(s: string): s is AppSlug {
  return s in APPS;
}
