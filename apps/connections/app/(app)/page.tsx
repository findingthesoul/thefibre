import { redirect } from 'next/navigation';

// The landscape IS the app — there is no separate dashboard to land on.
// docs/connections-model.md §6: it is a read over live tables, it asks for
// nothing, and it is useful on the first day. Anything else here would be a
// second front door to the same thing.
export default function ConnectionsHome() {
  redirect('/landscape');
}
