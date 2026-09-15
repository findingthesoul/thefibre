#!/usr/bin/env node
// fibre-mcp — The Fibre as an MCP server.
//
// Two ways to run it:
//
//   stdio (default)   The MCP client spawns this process. One app key, from
//                     FIBRE_APP_KEY. This is what Claude Desktop, Claude Code
//                     and most local clients do.
//
//   --http [port]     Streamable HTTP on 127.0.0.1:<port> (default 3009). The
//                     app key comes from each request's Authorization header,
//                     never from the environment, so one process can serve any
//                     number of workspaces without ever holding a key of its
//                     own. Bind another interface with --host.
//
// Environment:
//   FIBRE_APP_KEY   fibre_ak_… (stdio mode only)
//   FIBRE_API       API base URL; defaults to production.

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { DEFAULT_API, FibreApiError, FibreClient, type WhoAmI } from './client.js';
import { buildServer } from './server.js';

const require = createRequire(import.meta.url);
const VERSION: string = (require('../package.json') as { version: string }).version;

function log(msg: string): void {
  // stdout is the MCP channel in stdio mode; everything human goes to stderr.
  process.stderr.write(`[fibre-mcp] ${msg}\n`);
}

function parseArgs(argv: string[]) {
  const out = { http: false, port: 3009, host: '127.0.0.1', help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--http') {
      out.http = true;
      const next = argv[i + 1];
      if (next && /^\d+$/.test(next)) {
        out.port = Number(next);
        i++;
      }
    } else if (a === '--host') {
      out.host = argv[++i] ?? out.host;
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

const HELP = `fibre-mcp ${VERSION} — The Fibre as an MCP server

  fibre-mcp                 stdio; app key from FIBRE_APP_KEY
  fibre-mcp --http [port]   Streamable HTTP; app key from each request's
                            Authorization: Bearer header (default port 3009)
  --host <addr>             interface for --http (default 127.0.0.1)

  FIBRE_API                 API base URL (default ${DEFAULT_API})
`;

async function runStdio(apiUrl: string): Promise<void> {
  const appKey = process.env.FIBRE_APP_KEY;
  if (!appKey) {
    log('FIBRE_APP_KEY is not set. Mint a key at Settings → Apps → your app → Manage API keys.');
    process.exit(2);
  }
  const client = new FibreClient({ apiUrl, appKey });
  let whoami: WhoAmI;
  try {
    whoami = await client.whoami();
  } catch (err) {
    log(err instanceof FibreApiError ? err.describe() : String(err));
    process.exit(2);
  }
  const server = buildServer({ client, whoami, version: VERSION });
  await server.connect(new StdioServerTransport());
  log(`connected as ${whoami.app_slug} in workspace ${whoami.workspace_id} (${whoami.scopes.length} scopes) via ${apiUrl}`);
}

// --------------------------------------------------------------------------
// HTTP mode. Stateless: every request builds a server for the key it carries.
// whoami is cached per key hash for a minute so a chatty client does not pay
// a round-trip per tool call; revocation still lands within that minute.
// --------------------------------------------------------------------------
const WHOAMI_TTL_MS = 60_000;
const whoamiCache = new Map<string, { at: number; value: WhoAmI }>();

async function whoamiFor(client: FibreClient, appKey: string): Promise<WhoAmI> {
  const k = createHash('sha256').update(appKey).digest('hex');
  const hit = whoamiCache.get(k);
  if (hit && Date.now() - hit.at < WHOAMI_TTL_MS) return hit.value;
  const value = await client.whoami();
  whoamiCache.set(k, { at: Date.now(), value });
  return value;
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function runHttp(apiUrl: string, host: string, port: number): Promise<void> {
  const httpServer = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    if (url.pathname === '/health') return json(res, 200, { ok: true, version: VERSION, api: apiUrl });
    if (url.pathname !== '/mcp') return json(res, 404, { error: 'not found' });

    const auth = req.headers.authorization ?? '';
    const m = /^Bearer\s+(\S+)$/i.exec(auth);
    if (!m) {
      res.setHeader('WWW-Authenticate', 'Bearer realm="thefibre"');
      return json(res, 401, { error: 'send the app key as Authorization: Bearer fibre_ak_…' });
    }
    const appKey = m[1]!;

    let client: FibreClient;
    let whoami: WhoAmI;
    try {
      client = new FibreClient({ apiUrl, appKey });
      whoami = await whoamiFor(client, appKey);
    } catch (err) {
      const status = err instanceof FibreApiError ? err.status : 401;
      return json(res, status, { error: err instanceof FibreApiError ? err.describe() : String(err) });
    }

    const server = buildServer({ client, whoami, version: VERSION });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      const body = req.method === 'POST' ? await readBody(req) : undefined;
      await transport.handleRequest(req, res, body);
    } catch (err) {
      log(`request failed: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) json(res, 500, { error: 'internal error' });
    }
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  log(`listening on http://${host}:${port}/mcp → ${apiUrl}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    process.stdout.write(HELP);
    return;
  }
  const apiUrl = process.env.FIBRE_API ?? DEFAULT_API;
  if (args.http) await runHttp(apiUrl, args.host, args.port);
  else await runStdio(apiUrl);
}

main().catch((err) => {
  log(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
