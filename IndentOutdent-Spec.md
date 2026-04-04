# Indent/Outdent Tasks - Implementation Spec

## Context

Users need to reorganize their task hierarchy by moving tasks between levels. Currently tasks can only be reordered within a level (drag-and-drop). This feature adds indent (make subtask) and outdent (move up a level) buttons to each task row, using simple arrow buttons that work identically on web and iOS (Capacitor).

## Requirements

1. **Indent (→ arrow):** Clicking moves the task to become the last subtask of the task directly above it in the list. The task disappears from the current view. Entire subtree moves with it.
2. **Outdent (← arrow):** Clicking moves the task up one level — it becomes a sibling of its current parent, inserted right after the former parent. Entire subtree moves with it.
3. **Placement:** Both arrows on the left side of the row, between the drag handle and the title.
4. **Edge cases:**
   - At root level (top-level page): outdent (←) is NOT shown — tasks cannot be moved further up.
   - First task on the page: indent (→) is NOT shown — no task above to nest under.

## Implementation Plan

### Step 1: Add `indentTask` and `outdentTask` to `src/hooks/useTasks.js`

**`indentTask(taskId, newParentId)`:**
- Query max position among `newParentId`'s active children → `nextPosition`
- Update task: `{ parent_id: newParentId, position: nextPosition }`
- Return `{ success: true }` or `{ error }`

**`outdentTask(taskId, currentParentId)`:**
- Fetch the current parent task to get `grandparentId` (parent's `parent_id`) and `parent.position`
- Shift siblings of parent at the grandparent level that have `position > parent.position` (increment by 1) to make room
- Update task: `{ parent_id: grandparentId, position: parent.position + 1 }`
- Return `{ success: true }` or `{ error }`

Both operations only update `parent_id` and `position` — the subtree (children of the moved task) automatically follows because their `parent_id` still points to the moved task.

### Step 2: Update `src/components/tasks/TaskRow.jsx`

Add new props:
- `taskAbove` — the task object directly above in the list (null if first)
- `isRootLevel` — boolean, true when viewing root-level tasks
- `onIndent(taskId, newParentId)` — callback
- `onOutdent(taskId)` — callback

Add two arrow buttons between the drag handle and the title:
```
[drag handle] [← outdent] [→ indent] [title] [...actions]
```

- **← button**: Shown only when `!isRootLevel`. Calls `onOutdent(task.id)`.
- **→ button**: Shown only when `taskAbove !== null` (not the first task). Calls `onIndent(task.id, taskAbove.id)`.
- Style: `p-1 text-gray-300 hover:text-gray-500 shrink-0`, matching the drag handle's muted style.
- Touch guard: Add `[data-indent-btn]` to prevent swipe from triggering on these buttons.

### Step 3: Update `src/components/tasks/TaskList.jsx`

Pass new props through to `TaskRow`:
- Accept `isRootLevel`, `onIndent`, `onOutdent` from parent
- For each TaskRow, compute `taskAbove` from the tasks array (previous element, or null for index 0)
- Pass all four new props to each `<TaskRow>`

### Step 4: Update `src/pages/PlannerPage.jsx`

- Derive `isRootLevel = currentParentId === null`
- Add `handleIndent` callback: calls `indentTask(taskId, newParentId)`, refetches on success
- Add `handleOutdent` callback: calls `outdentTask(taskId, currentParentId)`, refetches on success
- Pass `isRootLevel`, `onIndent={handleIndent}`, `onOutdent={handleOutdent}` to `<TaskList>`

### Step 5: Save spec to project

Write this spec to `/Users/zhian/Projects/ToThread/IndentOutdent-Spec.md` for version control.

## File Change Summary

All paths relative to `webApp/planner/`:

| File | Action |
|------|--------|
| `src/hooks/useTasks.js` | Modify — add `indentTask`, `outdentTask` |
| `src/components/tasks/TaskRow.jsx` | Modify — add ←/→ buttons, new props |
| `src/components/tasks/TaskList.jsx` | Modify — pass new props through |
| `src/pages/PlannerPage.jsx` | Modify — add handlers, pass props |

## Verification

1. `cd webApp/planner && CI=true npm run build`
2. Deploy: `npx @insforge/cli@0.1.39 deployments deploy ./webApp/planner/dist -y`
3. Manual test:
   - At root level: no ← button on any task, → button on all tasks except the first
   - Click → on a task: it disappears, becomes last subtask of the task above
   - Navigate into that parent: the moved task appears at the end with its subtree intact
   - Click ← on a subtask: it disappears, appears right after its former parent at the parent's level
   - First task in a non-root list: ← visible (outdent), → hidden (first task)
   - Edge: single task on a page — neither arrow shown (first + only task)
4. Journal Entry 37
