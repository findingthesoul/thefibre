import { Breadcrumb, PageContainer, PageHeader } from '../page-chrome';
import { CurrencyCard } from '../currency-card';
import { workspaceCurrencies } from '@/lib/workspace-currency';

export default async function CurrenciesSettings() {
  const currency = await workspaceCurrencies();

  return (
    <PageContainer max="4xl">
      <Breadcrumb href="/settings" label="Settings" />
      <PageHeader
        title="Currencies"
        description="Workspace-level: one list of currencies for everything the workspace prices."
      />
      <div className="mt-8">
        <CurrencyCard
          defaultCurrency={currency.default_currency}
          currencies={currency.currencies}
        />
      </div>
    </PageContainer>
  );
}
