# @thefibre/mcp

The Fibre as an MCP server. An AI assistant connects with an **app key** and
gets one tool per route the app-key contract allows — nothing more.

```bash
pnpm --filter @thefibre/mcp build
FIBRE_APP_KEY=fibre_ak_… node packages/mcp/dist/cli.js          # stdio
node packages/mcp/dist/cli.js --http 3009                        # Streamable HTTP, key per request
```

Read [`docs/mcp.md`](../../docs/mcp.md) for the design, setup for Claude
Desktop / Claude Code, the scope → tool table, and what is deliberately absent.

- `src/client.ts` — the only HTTP in the package: bearer, JSON, errors.
- `src/tools.ts` — the catalogue; one entry per allow-list row.
- `src/server.ts` — builds an `McpServer` for one key, filtered by its scopes.
- `src/cli.ts` — stdio by default, `--http` for a stateless hosted mode.
- `src/mcp.test.ts` — reads the API's allow-list from source and holds every tool to it.
