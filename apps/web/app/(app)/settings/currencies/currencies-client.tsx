'use client';

import { useRouter } from 'next/navigation';
import { CurrencyEditor, type EcbRates } from '@thefibre/shared/ui/currency-editor';
import { saveCurrencies } from './actions';

export function CurrenciesClient({
  defaultCurrency,
  currencies,
  rates,
}: {
  defaultCurrency: string;
  currencies: string[];
  rates: EcbRates | null;
}) {
  const router = useRouter();
  return (
    <CurrencyEditor
      defaultCurrency={defaultCurrency}
      currencies={currencies}
      rates={rates}
      onSave={async (input) => {
        const r = await saveCurrencies(input);
        if (!r.error) router.refresh();
        return r.error ?? null;
      }}
    />
  );
}
