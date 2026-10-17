// Server side of the eye (find-me.tsx): your face and your per-community
// choices, both from loaders the page shares (cached per request). Renders
// nothing when no community has its member list switched on, and nothing
// when the choices could not be read — never a guessed privacy state.

import { loadDirectoryChoices, loadProfile } from '@/lib/session';
import { FindMe } from './find-me';

export async function FindMeSlot() {
  const [choices, profile] = await Promise.all([loadDirectoryChoices(), loadProfile()]);
  const withList = (choices ?? []).filter((c) => c.directory_enabled);
  if (!choices || withList.length === 0 || !profile) return null;
  const face = profile.face;
  const name =
    face?.display_name?.trim() ||
    [profile.first_name, profile.last_name].filter(Boolean).join(' ').trim() ||
    profile.email;
  return <FindMe name={name} photoUrl={face?.photo_url ?? null} choices={withList} />;
}
