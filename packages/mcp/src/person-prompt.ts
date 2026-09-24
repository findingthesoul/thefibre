// A prompt: turn a pasted schedule into a thread. Sjoerd, 2026-09-25: "can I
// also create a list (maybe we can provide a prompt) to create an event".
// A prompt is a recipe the client offers the person by name; the method it
// carries is the same one the server instructions summarise, spelled out.

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

export const SCHEDULE_PROMPT_NAME = 'plan_thread_from_schedule';

export function schedulePromptText(schedule: string, title: string | undefined): string {
  return [
    `Turn the schedule below into a thread in The Fibre${title ? ` called "${title}"` : ''}. Work in this order and stop to confirm with me before each write.`,
    '',
    '1. Read every row: a date and a step. Dates without a year belong to the coming occurrence; once the month wraps past December the year advances. Keep the rows in order.',
    '2. Sort each row into one of three kinds:',
    '   - AGENDA: something people attend or a date that structures the programme for them (a gathering, a reflection session, a deadline). Type event, conversation or workshop — a bracketed hint like [event] or [conversation] on the row decides; otherwise event. Give it a start and end time; default 10:00–11:00.',
    '   - MESSAGE: something that is SENT to participants (an invitation, a template, agenda and groups, certificates, a pattern note). Type message, or reflection when it asks them to reflect. It becomes an email once published; I decide that later.',
    '   - INTERNAL: a step for the organisers only (content ready, responses written, notes harvested). An agenda item with show_in_agenda false, so I see it on the timeline and participants do not.',
    '3. Show me the sorted list — date, kind, type, title — and ask me to correct anything.',
    '4. Create the thread with thread_create: blank, format journey if the schedule spans more than a few days, starts_on = the earliest row or the start I give you, ends_on = the latest row or the end I give you. Slug from the title.',
    '5. Add every row with ONE thread_add_engagements call. Everything lands as a draft.',
    '6. Tell me what was created, which rows became messages, and that nothing is published or sent until I publish it in The Thread.',
    '',
    'The schedule:',
    schedule.trim(),
  ].join('\n');
}

export function registerSchedulePrompt(server: McpServer): void {
  server.registerPrompt(
    SCHEDULE_PROMPT_NAME,
    {
      title: 'Plan a thread from a schedule',
      description: 'Paste a dated list of steps (a table of dates and what happens) and get a thread with every row on its timeline, all as drafts.',
      argsSchema: {
        schedule: z.string().min(1).max(20000).describe('The schedule, as pasted: one row per line, a date then the step'),
        title: z.string().max(200).optional().describe('The thread title, if you already know it'),
      },
    },
    ({ schedule, title }) => ({
      messages: [{ role: 'user', content: { type: 'text', text: schedulePromptText(schedule, title) } }],
    }),
  );
}
