import { PageContainer, PageHeader } from '@thefibre/shared/ui/page';
import { uiLocale } from '@/lib/locale';
import { t } from '@/lib/i18n-ui';
import { WarningsForm } from './warnings-form';

// Warnings you have switched off.
//
// Sjoerd, 2026-09-13, asking for the leaving-Connections warning: *"with a
// uncheck button for 'dont show this anymore' - to be resetted in
// preferences"*. This is that reset.
//
// One switch today. It is a page rather than a line on the settings hub
// because there will be more of them — every "do not ask me again" needs a
// home, and the alternative is that each one is unreachable once pressed,
// which is how a warning becomes a thing people cannot get back.

export default async function WarningsPage() {
  const locale = await uiLocale();
  return (
    <PageContainer>
      <PageHeader title={t(locale, 'warnings_card_title')} />
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">{t(locale, 'warnings_intro')}</p>
      <WarningsForm locale={locale} />
    </PageContainer>
  );
}
