'use client';

// The To do button in this app's topbar: the shared panel, wired to this
// app's server actions.

import { TodoPanelButton } from '@thefibre/shared/ui/todo-panel';
import { addTask, listTasks, removeTask, setTaskState } from '@/lib/todo-actions';

export function TodoButton() {
  return (
    <TodoPanelButton
      actions={{ list: listTasks, add: addTask, setState: setTaskState, remove: removeTask }}
    />
  );
}
