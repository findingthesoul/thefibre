import { redirect } from 'next/navigation';

// The page moved: Pulse speaks cashflow; "pipeline" is Fibre Flow's word
// (Sjoerd, 2026-07-08). Old links keep working.
export default function PipelineRedirect() {
  redirect('/cashflow');
}
