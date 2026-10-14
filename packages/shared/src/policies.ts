// The policies a participant agrees to (Sjoerd 2026-07-02): a maintained,
// versioned LIST in line with the app design — extend it here and every
// surface that enrols somebody picks it up. The accepted version is stored on
// the enrolment (policy_version / policy_accepted_at).
//
// Moved here from apps/thread/lib/policies.ts on 2026-10-14, when my.thread
// gained a one-click join: two apps record the same acceptance, and two lists
// would let one of them store a version the other has moved past.
//
// URLs come from branding.ts FOOTER_LINKS — the SPoT. Until v0.18.2 this
// pointed at /terms, which did not exist: every participant was ticking "I
// accept the privacy policy" against a 404. It now points at the real privacy
// statement, and the version is the date that document was written.

import { FOOTER_LINKS } from './branding.js';

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
    url: FOOTER_LINKS.privacy,
    version: '2026-10-02',
    required: true,
  },
];

/** The combined version string stored on an enrolment. */
export function policiesVersion(): string {
  return POLICIES.filter((p) => p.required)
    .map((p) => `${p.key}@${p.version}`)
    .join(',');
}
