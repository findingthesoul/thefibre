// Crawlers: open on production, closed on every preview and staging build.
// The policy lives in @thefibre/shared/robots so eight apps cannot drift —
// see that file for why "unknown environment" means "do not index".
import { robotsForEnvironment } from '@thefibre/shared/robots';

export default function robots() {
  return robotsForEnvironment(process.env.VERCEL_ENV);
}
