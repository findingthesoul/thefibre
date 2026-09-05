// Shim: the page-chrome kit lives in @thefibre/shared/ui/page (extraction
// phase 2). Breadcrumb binds next/link here (the package has no Next dep).

import Link from 'next/link';
import {
  PageContainer as SharedPageContainer,
  PageHeader,
  createBreadcrumb,
  SectionLabel,
  EmptyState,
  ErrorBanner,
} from '@thefibre/shared/ui/page';

export { PageHeader, SectionLabel, EmptyState, ErrorBanner };
export const Breadcrumb = createBreadcrumb(Link);


// This app sits LEFT of the sidebar (Suite-style) — align='left'.
export function PageContainer(props: Omit<Parameters<typeof SharedPageContainer>[0], 'align'>) {
  return <SharedPageContainer align="left" {...props} />;
}
