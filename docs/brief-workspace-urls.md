# Workspace public URLs — the grammar

_Decided with Sjoerd 2026-09-07 in the live loop ("Can this also be the
workspace?" … "It is the organisation. Sometimes even:
workspace/organiser/thread"). Supersedes the open design call in
build-plan 3b(a)._

## The grammar

```
app.thethread.app/{owner}/{thread}                personal · team · WORKSPACE
app.thethread.app/{workspace}/{organiser}/{thread}   the deeper address
app.thethread.app/{workspace}/{organiser}            organiser inside the workspace
```

- **D1 — scope is the thread's choice.** New-thread offers Personal /
  Team / Workspace. A workspace-scoped thread's canonical URL is
  `/{workspace}/{thread}`; it keeps its creating organiser internally.
- **D2 — the 3-segment form is an address, not a second scope.** For a
  workspace-scoped thread, `/{workspace}/{organiser}/{thread}` also
  resolves when the organiser matches the thread's organiser (canonical
  link tag points at the 2-segment form). `/{workspace}/{organiser}`
  lists that organiser's public threads within the workspace.
- **D3 — one slug namespace, workspaces win.** Organiser, team and
  workspace slugs share the first URL segment. Workspace slugs take
  precedence: creating an organiser or team slug equal to an existing
  workspace slug is refused (RESERVED_SLUGS pattern); the public
  resolver checks workspace → team → organiser in that order.
- The public API grows additively (a third owner kind + one 3-segment
  route); the published 2-segment shapes never change (rule 8;
  verify-public-api.mjs stays the gate). Embeds already accept
  `data-workspace` for lists; thread/card embeds gain it.

## Why

"It is the organisation": a workspace-run programme should read as the
organisation's course, not the organiser's page. The window is open —
no external embeds are live yet (2026-09-05), so the grammar can grow
without a compatibility tail.
