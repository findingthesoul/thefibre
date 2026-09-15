# One person, two capacities — proposal

**Status:** proposal, 2026-09-15. Nothing built. Decisions at the end.
**Asked by Sjoerd:** "How do we deal with the difference between a private
person and a business person?" and "Sjoerd Luteyn is a business owner
(sjoerd@soul.com) but also a private person… Should it be there twice? Or
should a person have multiple addresses with an indication (work, private)
like on an Apple phone?"

## The short answer

**One human is one person** in a workspace. Never twice.

Private or business is not a kind of person. It is the **capacity** someone
acts in at a particular moment. The same person books a course privately
today and for their employer tomorrow. So the capacity belongs to the
**transaction** (who pays this invoice), and the person gets **labelled
contact points** (work, private), like a phone's address book.

## What is true today (read from the code, 2026-09-15)

| Thing | Today |
|---|---|
| Person type | None. Correctly. |
| Employer | `org_membership` links a person to organisations (title, department, dates). |
| Emails / phones | Fixed columns: `email`, `email_secondary`, `phone`, `phone_secondary`. No labels. |
| Matching an incoming person | `lib/resolve-person.ts` matches on `(workspace, email)`, **primary email only**. |
| Buyer on an invoice | `purchase.payer_name`, `payer_email` and a `billing` snapshot (company, address, VAT number) typed at checkout. |
| VAT | `lib/vat.ts`: private → VAT; EU business with a validated VAT number, other country → reverse charge; non-EU → out of scope. |
| Organisation as customer | Only in Membership (holder = organisation, billing email on the org). |
| Duplicates | Contacts → Find duplicates; a merge sets `person.merged_into`. |

**Where the two-Sjoerds problem comes from.** Enrol privately with a Gmail
address, and `resolvePerson` finds no person with that primary email, so it
creates a second person. The duplicate is a direct result of matching on one
address.

## Proposal

### A. Labelled contact points (the address-book model)

A new table `person_contact_point`:

| column | meaning |
|---|---|
| `person_id`, `workspace_id` | whose |
| `kind` | `email` · `phone` |
| `value` | normalised (lower-case email; E.164 phone with country prefix) |
| `label` | `work` · `private` · `other` |
| `org_id` (nullable) | a work address can say *which* organisation it is for |
| `is_primary` | the one used by default for this kind |
| `verified_at` | set when the person signed in or confirmed a code with it |

- `person.email` / `person.phone` stay as the **primary** copy, kept in sync by
  a trigger, so the ~15 existing readers and the published app contract
  (`/api/v1/apps/*`, additive-only) keep working unchanged.
  `email_secondary` / `phone_secondary` migrate into rows and become read
  fallbacks, the same pattern as the payments SPoT.
- **Matching uses every email** a person has, not only the primary.
  So a private Gmail enrolment finds the existing person *if that address is
  already on them*.
- **No automatic merge across different addresses.** If sjoerd@soul.com and
  a Gmail address arrive separately, nothing can know they are one human, so
  they stay two until someone merges them. Merging then *moves the other
  addresses onto the kept person* as contact points (today it only marks the
  loser merged).
- The **domain-verified auto-attribution** (email domain → organisation)
  looks only at `work` addresses, so a private address never snaps someone
  to an employer.
- The contact card shows them grouped, as on a phone: *work · sjoerd@soul.com
  (soul.com)*, *private · …@gmail.com*. The Add person popup gets one email
  and one phone with a label, plus "+ add another".

### B. Who pays (the capacity)

At every checkout and invoice form: **"Who pays?"**
- **Myself**: private billing, as today.
- **An organisation**: the organisations the person belongs to are offered,
  or a new one. Billing details are filled in from the organisation.

Stored on the purchase: the `billing` snapshot as today (an issued invoice
never changes) **plus `payer_org_id`**. That one column gives:
- an **Invoices tab on the organisation**, the same shared `InvoicesArea` as on a contact;
- "everything EBBF bought" without string-matching company names;
- VAT reverse charge driven by the organisation's validated VAT number.

**Organisation billing details, one place.** Organisations get the complete set
workspaces already have (`legal_name`, address, `tax_no`, billing email),
read by every app through one helper, the way `lib/payment-accounts.ts` works
for sellers. Membership's organisation billing email moves onto it.

### C. What it means for sign-in

- An **account** (sign-in) and a **contact** (person) stay separate things.
  Signing in with any *verified* email on a person reaches that person's
  `/my` page, so Sjoerd sees his private and business enrolments in one place.
  That's his own data, and the workspace could already see both.
- An address only becomes a sign-in route once it is verified (code or Google).
  An address a curator typed in is never enough to sign in with.

## Privacy check

Joining someone's work and private identity is a real act under GDPR (it
builds a fuller profile). Hence: no automatic cross-address merge, merges are
a deliberate human act that is logged in activity, and the `/my` page shows
the person every address held on them (Article 15 export includes contact points).

## Order of work

1. **Contact points**: table, sync trigger, backfill from the four columns,
   matching on all emails, merge moves addresses, card + popup UI.
2. **Organisation billing details**: fields + one reader; Membership reads it.
3. **Who pays**: `payer_org_id`, the checkout choice in Thread, Meet and
   Membership, organisation Invoices tab.

Each ships on its own and is useful alone.

## Decisions for Sjoerd

1. **Labels:** `work · private · other`, or also `billing`?
2. **Phones:** store with country prefix (E.164) from now on, and ask for the
   prefix with a country dropdown? (Your earlier request for forms.)
3. **"Who pays" everywhere** (Thread, Meet, Membership), or Thread first?
4. **Your own two records** (Sjoerd Luteyn + Sjoerd Luteyn Test): merge them
   by hand once step 1 moves addresses on merge, or keep "Test" as a test fixture?
