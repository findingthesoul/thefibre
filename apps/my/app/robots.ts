// The visitor portal is never indexed, production included: every page below
// the sign-in is one person's own tickets, enrolments and memberships. This
// stops the crawl; the `robots` metadata in layout.tsx stops the listing.
import { robotsNeverIndex } from '@thefibre/shared/robots';

export default function robots() {
  return robotsNeverIndex();
}
