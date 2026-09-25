'use client';

// The To do button in this app's topbar: the shared panel, wired to this
// app's server actions. Open/closed is a domain-wide cookie, so the panel
// you left open is still open in the next app.

import { TodoPanelButton } from '@thefibre/shared/ui/todo-panel';
import { writePrefCookie } from '@thefibre/shared/prefs';
import { addTask, listTasks, removeTask, renameTask, setTaskState } from '@/lib/todo-actions';
import { savePref } from '@/lib/prefs-actions';
import { COOKIE_TODO } from '@/lib/prefs-shared';

export function TodoButton({ initialOpen = false }: { initialOpen?: boolean }) {
  return (
    <TodoPanelButton
      initialOpen={initialOpen}
      onOpenChange={(open) => {
        const value = open ? 'open' : 'closed';
        // Now, in the browser, so clicking straight through to another app
        // cannot outrun the write; then durably, from the server.
        writePrefCookie(COOKIE_TODO, value, process.env.NEXT_PUBLIC_COOKIE_DOMAIN);
        void savePref(COOKIE_TODO, value);
      }}
      actions={{
        list: listTasks,
        add: addTask,
        setState: setTaskState,
        remove: removeTask,
        rename: renameTask,
      }}
    />
  );
}
