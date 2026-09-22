'use client';

// Web's binding of THE person picker (packages/shared/src/ui/person-combobox).
//
// The component moved to shared on 2026-09-22 so Connect could use the same
// one rather than grow a second — Sjoerd: "There should be a Single Point of
// truth. It is existing somewhere else." All that is left here is the part
// that cannot be shared: this app's own `searchPeople` server action, bound
// once, so every result passes this caller's RLS.

import {
  PersonCombobox as SharedPersonCombobox,
  personLabel,
  type PersonComboboxProps,
} from '@thefibre/shared/ui/person-combobox';
import { searchPeople, type PersonOption } from '@/lib/person-actions';

export { personLabel };
export type { PersonOption };

export function PersonCombobox(props: Omit<PersonComboboxProps, 'search'>) {
  return <SharedPersonCombobox {...props} search={searchPeople} />;
}
