# Tasks To Do Page - Implementation Spec

## Context

The user wants a new "Tasks To Do" page as the default landing page for regular users. Currently, `/` routes to PlannerPage, which shows one level of the task hierarchy at a time. The new TodoPage provides a cross-hierarchy "what should I work on next" view by aggregating qualifying tasks from the entire task tree.

## Requirements

1. **Default landing page** for regular users at `/`
2. **PlannerPage** moves to `/planner`
3. A task qualifies as "todo" if EITHER:
   - Tagged with `#Todo` in its `tags` TEXT[] array (case-sensitive), OR
   - It is the **deepest displayed task** on the top unfinished recursive path (DFS by position) under a Continuous task, OR
   - It is a Continuous task with no displayed child task
4. Each todo task shows a **parent chain breadcrumb** above it
5. Same row features as PlannerPage: status badge, subtask badge, navigate arrow, mark done, delete with confirm, detail overlay, swipe gestures
6. **No drag-and-drop** reordering
7. Navigate arrow goes to **PlannerPage** focused at the task's parent level (via router state)
8. Marking Done: `#Todo`-tagged tasks stay visible (strikethrough); Continuous tasks advance to the next recursive unfinished path
9. **`Misc Todos` exception**:
   - Remove the `Misc Todos` task and its entire subtree from the normal Todo results
   - Render `Misc Todos` as a dedicated section at the bottom of the page
   - Always show every active descendant in that section, including Done tasks, in DFS/position order
   - Show breadcrumbs relative to the `Misc Todos` root for nested descendants

## Implementation Plan

### Step 1: Add helpers to `src/lib/taskTree.js`

Add 5 new exported pure functions (append to existing file):

- **`buildTaskMap(tasks)`** - Returns `Map<id, task>` for O(1) lookup
- **`buildChildrenMap(tasks)`** - Returns `Map<parentId|null, task[]>` with children sorted by position
- **`findFirstNonDoneLeaf(taskId, childrenMap)`** - DFS traversal finding first leaf (no children) that isn't Done. Returns task or null
- **`findFirstNonDonePath(taskId, childrenMap)`** - DFS traversal returning the first unfinished recursive path under a task, one task per level
- **`computeTodoTasks(tasks, taskMap, childrenMap)`** - Collects qualifying tasks via Set (tag check + deepest displayed Continuous-path task), returns task array
- **`buildParentChain(taskId, taskMap)`** - Walks parent_id chain upward, returns `[{id, title}]` from root down (excludes the task itself). Includes maxDepth=100 safety guard

### Step 2: Create `src/hooks/useTodoTasks.js`

New hook that fetches ALL user tasks in one query (no parent_id filter), then computes derived state client-side.

- **State**: `allTasks`, `loading`, `error`
- **Derived** (via useMemo):
  - `todoItems` array of normal qualifying `{ task, parentChain, childCount }` objects
  - `miscTodosTask` plus `miscTodoItems` containing every descendant of the `Misc Todos` task
- **Operations**: `fetchAllTasks()`, `markDone(taskId)`, `softDeleteTask(taskId)`, `getTaskById(taskId)`, `updateTask(taskId, fields)`
- Each mutation calls `fetchAllTasks()` after success to re-derive the todo list

### Step 3: Create `src/components/tasks/TodoTaskRow.jsx`

New component without `useSortable` dependency (TaskRow's `useSortable` hook requires DndContext/SortableContext).

- **Props**: `task`, `childCount`, `parentChain`, `onNavigateToPlanner(task, parentChain)`, `onMarkDone(taskId)`, `onDelete(taskId)`, `onOpenDetail(task)`
- **Layout**: Breadcrumb row (if parentChain non-empty) above main row
- **Main row**: Title, StatusBadge, SubtaskBadge, navigate arrow, mark done button, delete with confirm
- **Swipe**: Right >80px = navigate to planner, Left <-80px = delete confirm (no drag handle guard needed)

### Step 4: Create `src/components/tasks/TodoList.jsx`

Simple list component (no DndContext/SortableContext).

- **Props**: `todoItems`, `loading`, `onNavigateToPlanner`, `onMarkDone`, `onDelete`, `onOpenDetail`
- Empty state: "No tasks to do." with link to Planner
- Maps `todoItems` to `<TodoTaskRow>`
- Renders `Misc Todos` as a separate bottom section and maps all descendants to `<TodoTaskRow>`

### Step 5: Create `src/pages/TodoPage.jsx`

New page component.

- Uses `useAuth()` for user, `useTodoTasks(userId)` for data
- **Handlers**: handleNavigateToPlanner (navigate to `/planner` with `{ state: { initialNavStack: parentChain } }`), handleMarkDone, handleDelete, handleOpenDetail, handleSaveDetail
- **Render**: AppShell > "Tasks To Do" heading > error banners > TodoList > TaskDetailOverlay
- No AddTaskButton, no import/export, no showFinished toggle, no NavBar

### Step 6: Modify `src/App.jsx`

- Import `TodoPage`
- Change `/` route: `PlannerPage` -> `TodoPage` (keep ProtectedRoute + RoleGate wrapping)
- Add `/planner` route: `<ProtectedRoute><RoleGate><PlannerPage /></RoleGate></ProtectedRoute>`

### Step 7: Modify `src/pages/PlannerPage.jsx`

- Import `useLocation` from react-router-dom
- Initialize navStack from `location.state?.initialNavStack || []`
- Clear consumed state on mount: `window.history.replaceState({}, '')`

### Step 8: Modify `src/components/layout/AppShell.jsx`

- Import `useLocation` from react-router-dom
- Replace the user-role navigation section with:
  - "To Do" link (-> `/`, highlighted when active)
  - "Planner" link (-> `/planner`, highlighted when active)
  - "Admin" link (if has admin role, unchanged)
- Active link style: `text-blue-600 font-medium`

## File Change Summary

All paths relative to `webApp/planner/`:

| File | Action |
|------|--------|
| `src/lib/taskTree.js` | Modify - add 5 helpers |
| `src/hooks/useTodoTasks.js` | Create |
| `src/components/tasks/TodoTaskRow.jsx` | Create |
| `src/components/tasks/TodoList.jsx` | Create |
| `src/pages/TodoPage.jsx` | Create |
| `src/App.jsx` | Modify - routing |
| `src/pages/PlannerPage.jsx` | Modify - accept initialNavStack |
| `src/components/layout/AppShell.jsx` | Modify - nav links |

## Verification

1. `cd webApp/planner && CI=true npm run build` - must succeed with no errors
2. Deploy: `npx @insforge/cli@0.1.39 deployments deploy ./webApp/planner/dist -y`
3. Manual test:
   - Login as regular user -> lands on TodoPage
   - Tasks tagged `#Todo` appear with breadcrumbs
   - If a Continuous task has no displayed child, the Continuous task itself appears
   - Otherwise only the deepest displayed task on the first unfinished recursive path appears, with ancestors shown in the breadcrumb
   - Navigate arrow goes to PlannerPage at correct level
   - Mark done works (tag-based stay visible, Continuous displayed task advances)
   - `Misc Todos` appears only as the bottom section heading
   - All active descendants of `Misc Todos`, including Done tasks, appear in hierarchy order without duplicates in the normal list
   - Delete works with confirmation
   - Detail overlay opens and saves
   - AppShell "To Do" and "Planner" links work with active highlighting
   - Swipe gestures work on mobile
4. Journal Entry 36 in `Journal/Journal-2026-04.md`
