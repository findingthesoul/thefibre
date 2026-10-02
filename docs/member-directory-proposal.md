# Member directory — members finding each other

Sjoerd, 2026-10-02:

> *"Members — need to see each other. Can we create a list of members. With
> profiles. Ways to contact them. And maybe add that to my.thread. Maybe
> members can add a few tags to them. Or some predefined categories of
> interest. Maybe a main location. And then people can select/find and reach
> out to each other."*
>
> *"Maybe someone can state: visible in the list or not."*

That last line is the whole design, and it is the right instinct: a directory
of people is the most sensitive surface this platform has, and the only safe
default is that nobody is in it until they say so.

## 1. Most of this already exists

Worth knowing before anything is built, because it changes the size of the
job and it sets the precedent to follow.

**The consent-gated people list is already a decided pattern.** The Thread's
`/my` shows your fellow participants, gated on a `consent_record` with
`purpose_code = 'cohort_directory'`, and only where the thread's own
`share_participants_participants` switch is on. It shows **first name + last
initial and nothing else** — no email, no photo, no link. Two gates, minimum
data. This proposal extends that pattern rather than inventing a second one.

**The profile fields exist too**, on tables we already keep:

| What he asked for | Where it already lives |
|---|---|
| Profile (name, photo, bio) | `user_profile.display_name / photo_url / bio` |
| Main location | `person.city / region / country` |
| Ways to contact | `person_contact_point` (typed, labelled), plus `person.linkedin_url`, `website_url`, `phone` |
| Languages, pronouns | `person.languages_spoken`, `person.pronouns` |

**Only two things are genuinely missing:** interest tags, and the
visible-or-not switch.

## 2. What to build

- **`member_directory` consent**, per person per workspace. Off until stated.
  A new purpose code beside `cohort_directory` rather than reusing it: a
  member agreeing to appear in their community's directory has not agreed to
  appear in a course cohort, and one revocation must not silently undo the
  other.
- **A visibility choice per FIELD GROUP**, not one switch. "In the list" and
  "show my phone number" are different consents, and a single toggle forces
  the cautious member to choose between invisible and fully exposed. Minimum:
  *listed* · *contact details* · *location*.
- **Tags**, on the person, owned by the Membership app (`app_id`-tagged
  curator data — brief §5, "the app justifies the field").
- **The list itself in my.thread**, which is where a member already goes.
  Filter by tag and location; the member's own card first with an obvious way
  to change what it shows.

## 2b. The bio is a plain textarea, and should not be

Sjoerd: *"In the profile field - also a WYSIWYG (Single Point of Truth)."*

He is right that it is a SPoT gap. `@thefibre/shared/ui/rich-text` is THE
editor — Thread uses it for threads, engagements, templates, themes and the
website settings; My Thread renders it. The one field that describes a
PERSON is a `<textarea rows={3}>` in `packages/shared/src/ui/profile-form.tsx`.

**But it is not a one-line swap, and the reason matters more than the swap.**
Today `bio` is plain text, and several surfaces render it as plain text.
Turning it into HTML without following it through puts tags on a public page:

| Reader | What it does today |
|---|---|
| `apps/meet/.../settings/profile/form.tsx` | `{host.bio \|\| …}` — raw render |
| `apps/api/src/routes/meet.ts:385, :459` | host bio on PUBLIC meeting-type and booking pages |
| `apps/api/src/routes/meet.ts:2876` | host payload |

This is the same failure a calendar feed hit on 2026-09-25: rich text written
into a surface with no markup, read back with the tags showing.
`@thefibre/shared/rich-text-plain` (`richTextToPlain`) exists precisely for
it. So the change is: switch the editor, then make every reader either render
rich text or flatten it — and verify the PUBLIC booking page, not just the
settings form.

It is independent of D1–D4 and can ship first.

## 3. Decided (Sjoerd, 2026-10-02)

**D1 — Contact details are a CHECK, with a group default.**
The workspace sets the default for its members; each member can change it on
their own profile. So a community can start closed and let people open up, or
start open and let people withdraw — without either being forced.

**D2 — Tags are the member's own, capped at three, and reuse what exists.**
Free text with a hard cap and suggestions as you type, not a curated list.
The cap is what keeps it honest: three forces a choice, and suggestions pull
the fourth person towards "facilitation" instead of minting "Facilitation".

**CATEGORIES are a different thing and belong to the workspace.** They are
not tags with a different name:

- the **workspace** defines the categories;
- a **product** carries one or more of them — a member's category comes from
  what they hold, never from what they type;
- the workspace picks the visibility mode: **category sees only its own
  category**, or **everybody sees everybody**.

That is the answer to D3 as well. Visibility follows category, and because
category follows product, a community that sells a closed circle gets a
closed circle without anybody administering a list.

**D4 — A lapsed membership drops out of the list immediately**, consent or
no consent: the consent was to be visible to fellow members.

## 4. Consent: opt-OUT, stated at joining

Sjoerd: *"when joining as a member: you consent to info sharing with
members.. yet... you can opt out in your profile."*

This reverses the recommendation in §2 and it is his decision, made with the
trade-off in front of him. What it requires to be sound:

- the join page **says so where the member agrees**, in the flow, not only in
  a policy page they never open;
- the opt-out is **easy to find and takes effect immediately**;
- a `consent_record` is still written per member, so there is a record of
  what they were told and when, and a revocation has somewhere to land.

The distinction to hold: being LISTED is covered by joining. CONTACT DETAILS
are the check from D1 and default to whatever the workspace set — those two
should never be collapsed into one switch.

## 5. Later, not now

*"A thread can have a unique code and category — so participants can easily
see each other if it is checked; that check is already there."*

Correct, it is: `share_participants_participants` on the thread plus the
`cohort_directory` consent. The unique code and the category are the new
part, and they make a thread's cohort behave like a small directory of its
own. Parked deliberately — the member directory should exist first, because
the thread version is the same mechanism scoped smaller.

## 6. One thing to check with a lawyer, not with me

A member directory processes personal data for a purpose the member must
understand before agreeing. The privacy statement (`/privacy-policy`, still
unreviewed by a lawyer per the 2026-09 note) does not currently describe a
member directory. That text needs to exist before the first member is listed,
not after.
