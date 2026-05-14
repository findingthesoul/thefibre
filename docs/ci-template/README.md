# CI workflow (not yet installed)

`ci.yml` in this folder is ready to drop into `.github/workflows/` once a GitHub token with the `workflow` scope is available. The overnight session tried to install it but the existing PAT lacked the scope, so it lives here as a template.

## How to install (one-time)

1. Use a token with **`workflow`** scope (a Fine-grained PAT with "Actions" repository permission = read/write, or a classic PAT with the `workflow` scope checked).
2. `mkdir -p .github/workflows && cp docs/ci-template/ci.yml .github/workflows/`
3. `git add .github/workflows/ci.yml && git commit && git push`

That's it — the workflow runs `pnpm install`, `pnpm -r typecheck`, and builds both the web (with placeholder Supabase env vars) and the api on every push / PR.
