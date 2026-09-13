// "You are about to leave Connections."
//
// Sjoerd, 2026-09-13: *"I just want to have a warning (with a uncheck button
// for 'dont show this anymore' - to be resetted in preferences)... that I am
// leaving connections and going to detailed personal data (with a YES and
// CANCEL button)."*
//
// ── This replaces an earlier fix for the same complaint ────────────────────
//
// The Fibre link used to navigate in place, and he said (2026-09-13, earlier
// the same day): *"moving to the fibre (more contact info) is confusing...
// youre totally left connections then"*. The answer then was to open it in a
// new tab. This is the better answer to the same thing: what he wanted was to
// KNOW he was leaving, not to be quietly teleported somewhere else — and a new
// tab solves that by never leaving at all, which costs a tab every time.
//
// ── Why localStorage and not the preference cookies ────────────────────────
//
// `Prefs` is theme and sidebar: two keys, shared by all nine apps, stamped in
// cookies so the server can render the right chrome on the first paint. This
// is neither cross-app nor needed before paint, and adding a Connections-only
// key to a cross-app type would make every other app carry it.
//
// The cost is honest and worth saying out loud in the reset control: this is
// PER DEVICE. Dismissing the warning on a laptop does not dismiss it on a
// phone. For a warning about stepping into detailed personal data that is
// arguably the right scope anyway — the phone is the device that leaves the
// building.

const KEY = 'connections:skip-leaving-warning';

/** Has this device been told not to ask again? */
export function warningSuppressed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    // A viewer who blocks storage simply gets asked every time, which is the
    // safe direction for a warning.
    return false;
  }
}

/** Remember the answer to "do not show this anymore". */
export function suppressWarning(): void {
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* nothing to do: they will be asked again, which is not harmful */
  }
}

/** Ask again from now on. The reset control in Settings calls this. */
export function resetWarning(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* already effectively reset */
  }
}
