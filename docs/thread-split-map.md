# thread.ts split map (as of v0.13.109, ~4.7k lines)

Produced by the 2026-07-07 cleanup sweep. Input for open-queue item
"Split apps/api/src/routes/thread.ts" — pure mechanical moves, typecheck
between steps. Line numbers drift with every release; the section order
and dependency structure won't.

## External contract (what other files import from thread.js)

- `server.ts` → `threadRoutes`, `runThreadMessageScheduler`
- `routes/purchases.ts` → `finalizePaidEnrolment`
- `sendTriggeredMessages` is exported but has no external importer.

## Sections (in file order)

| # | content | shared in-file deps |
|---|---------|---------------------|
| 1 | participant-JWT identity (participantJwks, participantEmailFromAuth) | — |
| 2 | app init, slugField, engagementFamily | — |
| 3 | organiser + workspace settings (GET/PATCH /me, /settings) | slugField, lib payment-accounts + connections |
| 4 | threads CRUD + duplicate; shiftDateOnly/Timestamp | slugField |
| 5 | engagements CRUD; activityWindowError | engagementFamily |
| 6 | teams + people pickers | slugField |
| 7 | thread members | — |
| 8 | thread templates (save-as / instantiate) | filterVisibleTemplates, shiftDateOnly |
| 9 | certificate issuance (+ public certificate page) | threadAppUrl, lib email |
| 10 | tickets + coupons CRUD | — |
| 11 | POST /uploads | (near-dup of meet's) |
| 12 | certificate templates CRUD + send-certificate | userTeamIds, filterVisibleTemplates |
| 13 | enrolment lifecycle: loadEnrolmentForAction, logEnrolmentActivity, approve / participants / decline / complete | sendTriggeredMessages, issueCertificate |
| 14 | payments: finalizePaidEnrolment, stripe-webhook, mark-paid | logEnrolmentActivity, lib fees/purchases |
| 15 | cert-template archive/delete/shares — **stranded ~1000 lines from §12; reunite** | userTeamIds |
| 16 | GET /enrolments (workspace view) | — |
| 17 | public reads: resolvePublicOwner, ticketPrices, effectivePrice; organiser/thread/embed/my-enrolments | participantEmailFromAuth |
| 18 | coupon validation (couponPrice, findValidCoupon) | resolvePublicOwner |
| 19 | POST /public/enrol (~600-line route) | §17+18 helpers, sendTriggeredMessages |
| 20 | message rendering: stripHtml, renderMessageBody, sendTriggeredMessages | lib email |
| 21 | scheduler: runThreadMessageScheduler + POST /scheduler/run | wallTimeToUtc, §20 |

## Natural split seams (dependency-clean)

1. **public.ts** — §17–19 (needs §18 helpers + an import of sendTriggeredMessages)
2. **messaging.ts** — §20–21 (self-contained given lib/email)
3. **certificates.ts** — §9 + §12 + §15 (reunites the stranded block)
4. **lifecycle.ts** — §13–14 (owns loadEnrolmentForAction, logEnrolmentActivity,
   finalizePaidEnrolment — the export purchases.ts depends on)
5. Remainder (CRUD/settings/teams/templates) can stay or split later.

**Move to lib/ first** (used across nearly all seams): `threadAppUrl`,
`slugField` (+ shared duplicated helpers: person-find-or-create,
displayName join, `one()` embed-normalize, activity insert — see
build-plan "code cleanliness" notes).
