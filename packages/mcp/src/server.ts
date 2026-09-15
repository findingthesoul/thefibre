// Builds an MCP server for one app key.
//
// The server is per credential on purpose: which tools it offers is decided by
// the scopes the API says the key holds (GET /apps/whoami), so an assistant
// sees only what it can actually do. The API still checks every call — this
// filter is a courtesy to the model, not the enforcement layer.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { FibreApiError, type FibreClient, type WhoAmI } from './client.js';
import { toolsForScopes, type ToolDef } from './tools.js';

export const SERVER_NAME = 'thefibre';

export interface BuildServerOptions {
  client: FibreClient;
  whoami: WhoAmI;
  version: string;
}

export function instructionsFor(whoami: WhoAmI): string {
  return [
    `You are connected to The Fibre as the app "${whoami.app_slug}", in one workspace (${whoami.workspace_id}).`,
    `Scopes held: ${whoami.scopes.length ? whoami.scopes.join(', ') : 'none'}. Only tools within those scopes are offered.`,
    '',
    'What The Fibre is: a shared people-and-organisations layer for purpose-driven work. This app owns its own records and',
    'links them to platform persons and organisations; it reaches other apps only through the activity log (type + subject).',
    '',
    'Rules that hold on every call:',
    '- You can only see records this app linked itself. There is no search across the workspace.',
    '- Activity is append-only and its subject is visible to the whole workspace: keep it short, never sensitive, never a body.',
    '- Programmes (The Thread) and runs (Flow) you can read or change are the ones this app published or started.',
    '- Registration always comes from the public form. You can approve, decline or check people in; you cannot enrol anyone.',
    '- Money, tickets, certificates and registration fields are set by a human in the app, never from here.',
    '',
    'When the API refuses (403), the key lacks a scope or the route is outside the app-key contract. Do not work around it;',
    'tell the person which scope is missing so a workspace admin can mint a key that carries it.',
  ].join('\n');
}

function textResult(value: unknown): CallToolResult {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: 'text', text: text ?? 'null' }] };
}

function errorResult(err: unknown): CallToolResult {
  const text =
    err instanceof FibreApiError
      ? err.describe()
      : err instanceof Error
        ? `${err.name}: ${err.message}`
        : String(err);
  return { content: [{ type: 'text', text }], isError: true };
}

/** Register one tool definition on a server. Exported for tests. */
export function registerTool(server: McpServer, def: ToolDef, client: FibreClient, slug: string): void {
  server.registerTool(
    def.name,
    {
      title: def.title,
      description: def.description,
      inputSchema: def.input,
      annotations: {
        title: def.title,
        readOnlyHint: def.readOnly,
        destructiveHint: def.readOnly ? false : (def.destructive ?? false),
        idempotentHint: def.readOnly ? true : (def.idempotent ?? false),
        openWorldHint: false,
      },
    },
    async (args: Record<string, unknown>) => {
      try {
        // registerTool has already validated `args` against def.input; the
        // parse here narrows the type and strips anything undeclared.
        const parsed = z.object(def.input).parse(args ?? {});
        const result = await def.run(client, slug, parsed);
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}

export function buildServer({ client, whoami, version }: BuildServerOptions): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, title: 'The Fibre', version },
    { instructions: instructionsFor(whoami) },
  );
  for (const def of toolsForScopes(whoami.scopes)) {
    registerTool(server, def, client, whoami.app_slug);
  }
  return server;
}
