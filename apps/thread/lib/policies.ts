// The policies a participant agrees to (Sjoerd 2026-07-02): a maintained,
// versioned LIST in line with the app design — extend it here and every
// public surface (enrol form, embeds) picks it up. The accepted version is
// stored on the enrolment (policy_version / policy_accepted_at).
//
// URLs point at the Fibre legal pages (branding.ts FOOTER_LINKS is the SPoT
// for the base; specific documents live under it).

export type Policy = {
  key: string;
  /** i18n catalog key for the link label. */
  labelKey: 'policy_privacy';
  url: string;
  /** Bump when the document meaningfully changes. */
  version: string;
  /** Required to enrol (unchecked by default — GDPR: never pre-ticked). */
  required: boolean;
};

export const POLICIES: Policy[] = [
  {
    key: 'privacy',
    labelKey: 'policy_privacy',
    url: 'https://thefibre.app/terms',
    version: '2026-07-02',
    required: true,
  },
];

/** The combined version string stored on an enrolment. */
export function policiesVersion(): string {
  return POLICIES.filter((p) => p.required)
    .map((p) => `${p.key}@${p.version}`)
    .join(',');
}
