'use server';

// The Thread's binding of the in-app assistant (docs/assistant-in-app.md).
//
// The browser never talks to a model. It calls this action; the action calls
// the EU API with the person's own session; the API calls the model. That is
// hard rule 1 (no personal data in Vercel) kept the same way every other
// server action keeps it — nothing is stored here, nothing is logged here.

import { apiFetch, ApiError } from './api';
import type { AssistantRequest, AssistantResponse } from '@thefibre/shared/ui/assistant';

export async function assistantChat(
  req: AssistantRequest,
  locale: string,
): Promise<AssistantResponse> {
  try {
    return await apiFetch<AssistantResponse>('/api/v1/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        app: 'the-thread',
        messages: req.messages,
        approve: req.approve,
        decline: req.decline,
        locale,
        today: new Date().toISOString().slice(0, 10),
      }),
    });
  } catch (e) {
    const error =
      e instanceof ApiError
        ? ((e.body as { error?: unknown } | undefined)?.error as string | undefined) ?? `API ${e.status}`
        : 'could not reach the assistant';
    return { messages: req.messages, reply: '', steps: [], pending: null, error: String(error) };
  }
}

/** Is the assistant switched on for this API deployment? */
export async function assistantEnabled(): Promise<boolean> {
  try {
    const r = await apiFetch<{ enabled: boolean }>('/api/v1/assistant/status');
    return !!r.enabled;
  } catch {
    return false;
  }
}
