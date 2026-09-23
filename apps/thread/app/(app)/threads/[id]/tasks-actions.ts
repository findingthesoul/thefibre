'use server';

// Server actions for the per-thread To do list.
//
// Its own file, beside registrations-actions.ts and for the same reason:
// ../actions.ts is the thread CRUD surface, and this exists only for the
// to-do popup.
//
// These reach /api/v1/thread/*, NOT /api/v1/tasks. The thread's list is
// Thread's own content and is not behind the Organisation-plan gate the
// personal cross-app list carries.

import { apiFetch, errorMessage } from '@/lib/api';

export type ThreadTask = {
  id: string;
  thread_id: string;
  title: string;
  notes: string | null;
  due_on: string | null;
  assignee_user_id: string | null;
  assignee_name?: string | null;
  team_id: string | null;
  status: 'open' | 'done';
  done_at: string | null;
  position: number;
  source_template_id: string | null;
};

export type TodoTemplate = {
  id: string;
  title: string;
  scope: 'personal' | 'team' | 'workspace';
  structure: { version: number; tasks: { title: string; notes?: string | null; day_offset?: number | null }[] };
};

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listThreadTasks(
  threadId: string,
): Promise<Result<{ items: ThreadTask[]; open_count: number; thread_team_id: string | null }>> {
  try {
    const data = await apiFetch<{ items: ThreadTask[]; open_count: number; thread_team_id: string | null }>(
      `/api/v1/thread/threads/${threadId}/tasks`,
    );
    return { ok: true, data };
  } catch (e) {
    // NOT an empty list. A caller that turned this into [] would draw
    // "nothing to do yet" over a list that exists.
    return { ok: false, error: errorMessage(e) };
  }
}

export async function addThreadTask(
  threadId: string,
  input: { title: string; due_on?: string | null; assignee_user_id?: string | null },
): Promise<Result<ThreadTask>> {
  try {
    const data = await apiFetch<ThreadTask>(`/api/v1/thread/threads/${threadId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function patchThreadTask(
  taskId: string,
  patch: Partial<Pick<ThreadTask, 'title' | 'notes' | 'due_on' | 'assignee_user_id' | 'status' | 'position'>>,
): Promise<Result<ThreadTask>> {
  try {
    const data = await apiFetch<ThreadTask>(`/api/v1/thread/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function removeThreadTask(taskId: string): Promise<Result<null>> {
  try {
    await apiFetch(`/api/v1/thread/tasks/${taskId}`, { method: 'DELETE' });
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function listTodoTemplates(): Promise<Result<TodoTemplate[]>> {
  try {
    const data = await apiFetch<{ items: TodoTemplate[] }>('/api/v1/thread/todo-templates');
    return { ok: true, data: data.items };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function applyTodoTemplate(
  threadId: string,
  templateId: string,
): Promise<Result<{ items: ThreadTask[]; added: number }>> {
  try {
    const data = await apiFetch<{ items: ThreadTask[]; added: number }>(
      `/api/v1/thread/threads/${threadId}/tasks/apply-template`,
      { method: 'POST', body: JSON.stringify({ template_id: templateId }) },
    );
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}

export async function saveThreadTasksAsTemplate(
  threadId: string,
  title: string,
): Promise<Result<{ id: string; count: number }>> {
  try {
    const data = await apiFetch<{ id: string; count: number }>(
      `/api/v1/thread/threads/${threadId}/tasks/save-as-template`,
      { method: 'POST', body: JSON.stringify({ title }) },
    );
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: errorMessage(e) };
  }
}
