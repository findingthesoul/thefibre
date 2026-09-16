// One turn of the in-app assistant.
//
// The conversation is stateless on the server: the client holds the model
// messages (tool_use and tool_result blocks included) and sends them back
// every turn. Reads run at once. The first WRITE the model asks for stops the
// loop; the proposal is parked (pending.ts) and returned for a human to
// approve. Approving resumes the same turn with the parked arguments.
//
// Why a manual loop and not the SDK's tool runner: the runner cannot pause a
// turn, hand a proposal to a browser, and resume it in a later HTTP request.

import type Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { ASSISTANT_MAX_ITERATIONS, ASSISTANT_MAX_TOKENS, ASSISTANT_MODEL } from './model.js';
import { parkWrite, takeWrite } from './pending.js';
import { runTool, THREAD_TOOLS, TOOLS_BY_NAME, type ActorAuth } from './tools.js';

export type Msg = Anthropic.Beta.BetaMessageParam;

export interface TurnInput {
  client: Anthropic;
  auth: ActorAuth & { userId: string; workspaceId: string };
  messages: Msg[];
  /** Approve / decline a parked write from the previous answer. */
  approve?: string | undefined;
  decline?: string | undefined;
  /** For the system prompt. */
  today: string;
  locale: string;
}

export interface Step {
  tool: string;
  label: string;
  ok: boolean;
}

export interface Pending {
  id: string;
  tool: string;
  label: string;
  input: Record<string, unknown>;
}

export interface TurnOutput {
  messages: Msg[];
  reply: string;
  steps: Step[];
  pending: Pending | null;
  usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens: number };
  stop: string;
}

export function systemPrompt(today: string, locale: string): string {
  return [
    'You are the assistant inside The Thread, the programme and event tool of The Fibre. You help an organiser with their own threads: events and journeys people register for.',
    '',
    'What you can do is exactly what the tools do. Reading is free. Anything that creates or changes a thread is proposed to the person and only happens after they approve it in the interface — so never say something has been done until the tool result says so.',
    '',
    'How to work:',
    '- When asked to make a thread from a template, first list the templates, ask which one, and confirm the title and start date. Then propose the creation with one tool call.',
    '- Suggest a slug from the title (lowercase, hyphens). If the API says the slug is taken, propose another.',
    '- A new thread is a draft. Ask before setting it to active: active makes the page public and opens registration in one step.',
    '- Registration data reaches you as counts only. You do not know who registered; point the person to the thread\'s participants page for that.',
    '- The timeline is in reach: list_engagements shows what is on a thread; add, change and delete go through the approval card like every write. A message-family item emails everyone enrolled once the thread is active — say what would be sent and when before proposing one. The message text itself is written in the editor.',
    '- When the person refers to "the first one" or "that message", use list_engagements to identify it by title and position before proposing anything, and name it in your proposal.',
    '- Keep answers short and concrete. Name the thread and what will change. No filler.',
    '- If something is outside the tools (payments setup, tickets, certificates, participants, the text of a message), say where in The Thread it is done instead of guessing.',
    '',
    `Today is ${today}. The person's interface language is ${locale}; answer in that language unless they write in another.`,
  ].join('\n');
}

function textOf(content: Anthropic.Beta.BetaContentBlock[] | string): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

export async function runTurn(input: TurnInput): Promise<TurnOutput> {
  const { client, auth } = input;
  const messages: Msg[] = [...input.messages];
  const steps: Step[] = [];
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  const tools = THREAD_TOOLS.map((t) => t.definition);

  // ---- resume a parked write ---------------------------------------------
  if (input.approve || input.decline) {
    const id = input.approve ?? input.decline!;
    const rec = takeWrite(id, auth.userId);
    if (!rec) {
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: id, is_error: true, content: 'This proposal expired before it was approved. Ask again if it is still wanted.' }],
      });
    } else if (input.decline) {
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: id, content: 'The person declined this action. Do not retry it unless they ask again.' }],
      });
      steps.push({ tool: rec.tool, label: 'Declined', ok: true });
    } else {
      const tool = TOOLS_BY_NAME.get(rec.tool)!;
      const r = await runTool(tool, auth, rec.input);
      steps.push({ tool: rec.tool, label: tool.label(rec.input), ok: r.ok });
      messages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: id, content: r.content, ...(r.ok ? {} : { is_error: true }) }],
      });
    }
  }

  // ---- the loop -----------------------------------------------------------
  for (let i = 0; i < ASSISTANT_MAX_ITERATIONS; i++) {
    const res = await client.beta.messages.create({
      model: ASSISTANT_MODEL,
      max_tokens: ASSISTANT_MAX_TOKENS,
      // A chat turn with a handful of tools does not need deep reasoning.
      // Measured on staging 2026-09-16 at `medium`: 42 s of thinking before
      // the first tool call on "make a thread from a template". `low` is the
      // documented setting for chat and latency-sensitive routes; thinking
      // stays adaptive (Opus 5 default), just shallower. Re-tune from the
      // `[assistant] … ms=` log lines, not from taste.
      output_config: { effort: 'low' },
      // If a safety classifier declines, re-run on the default fallback chain
      // inside the same call rather than answering nothing.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: systemPrompt(input.today, input.locale), cache_control: { type: 'ephemeral' } }],
      tools,
      messages,
    });
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    usage.cache_read_input_tokens += res.usage.cache_read_input_tokens ?? 0;

    messages.push({ role: 'assistant', content: res.content });

    if (res.stop_reason === 'pause_turn') continue;
    if (res.stop_reason !== 'tool_use') {
      const reply =
        res.stop_reason === 'refusal'
          ? "I can't help with that one."
          : textOf(res.content) || (res.stop_reason === 'max_tokens' ? '(The answer was cut short.)' : '');
      return { messages, reply, steps, pending: null, usage, stop: res.stop_reason ?? 'end_turn' };
    }

    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    let pending: Pending | null = null;

    for (const use of uses) {
      const tool = TOOLS_BY_NAME.get(use.name);
      const args = (use.input ?? {}) as Record<string, unknown>;
      if (!tool) {
        results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: `Unknown tool ${use.name}` });
        continue;
      }
      if (tool.kind === 'read') {
        const r = await runTool(tool, auth, args);
        steps.push({ tool: tool.name, label: tool.label(args), ok: r.ok });
        results.push({ type: 'tool_result', tool_use_id: use.id, content: r.content, ...(r.ok ? {} : { is_error: true }) });
        continue;
      }
      // A write. The first one is parked and the turn ends here; any second
      // write in the same turn is answered, not executed.
      if (pending) {
        results.push({ type: 'tool_result', tool_use_id: use.id, is_error: true, content: 'One action at a time: ask again after the first one is approved.' });
        continue;
      }
      parkWrite({ id: use.id, userId: auth.userId, workspaceId: auth.workspaceId, tool: tool.name, input: args });
      pending = { id: use.id, tool: tool.name, label: tool.label(args), input: args };
    }

    if (pending) {
      // Results for the reads (and any refused extra writes) go in now; the
      // parked write's result arrives on approve/decline. The API requires a
      // tool_result for every tool_use in the next user turn, so the client
      // must come back through approve or decline — the UI offers nothing
      // else while a proposal is open.
      if (results.length) {
        // Cannot send a partial user turn now: the parked use still lacks a
        // result. Stash the finished ones on the pending record by replaying
        // them into the messages the client holds — the approve/decline turn
        // appends the last one and completes the set.
        messages.push({ role: 'user', content: results });
        // NOTE: a user turn with results for SOME tool_use ids and the next
        // user turn with the remaining one is accepted by the API as two
        // consecutive user messages, which it merges.
      }
      return { messages, reply: textOf(res.content), steps, pending, usage, stop: 'pending' };
    }

    messages.push({ role: 'user', content: results });
  }

  return {
    messages,
    reply: 'I stopped after several steps without finishing. Ask me to continue, or narrow the request.',
    steps,
    pending: null,
    usage,
    stop: 'max_iterations',
  };
}

/** For tests and the route: a stable id for a synthetic proposal. */
export const newId = (): string => randomUUID();
