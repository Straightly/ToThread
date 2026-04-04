# Drag-and-Drop Task Reordering

## Context

Tasks already have a `position` integer column that controls their display order. The user wants to reorder tasks by dragging them up/down instead of having a numeric priority field. A drag handle (grip icon) on the left of each row will activate dragging, keeping existing swipe gestures (right=navigate, left=delete) untouched.

## Dependencies

Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (modern, headless React DnD library).

## Files

| File | Action |
|------|--------|
| `package.json` | Add @dnd-kit dependencies |
| `src/hooks/useTasks.js` | Add `reorderTasks` batch position update |
| `src/components/tasks/TaskRow.jsx` | Add `useSortable` hook, drag handle, touch guard |
| `src/components/tasks/TaskList.jsx` | Wrap with DndContext + SortableContext, handle `onDragEnd` |
| `src/pages/PlannerPage.jsx` | Wire `handleReorder` callback, pass `onReorder` prop |

## Implementation

### 1. `useTasks.js` -- add `reorderTasks(updates)`

`updates` is `[{ id, position }, ...]`.

- **Optimistic update**: `setTasks(prev => ...)` -- clone tasks, overwrite positions from updates, re-sort by position ascending. UI snaps immediately.
- **Persist**: `Promise.all` of individual `insforge.database.from('tasks').update({ position }).eq('id', id)` calls. Fine for typical list sizes (5-50 tasks).
- **Error**: return `{ error }` on failure. Caller refetches to revert.
- Add to hook return object alongside existing exports.

### 2. `TaskRow.jsx` -- sortable item with drag handle

- Import `useSortable` from `@dnd-kit/sortable`, `CSS` from `@dnd-kit/utilities`.
- Call `useSortable({ id: task.id })` to get `{ attributes, listeners, setNodeRef, transform, transition, isDragging }`.
- Apply `setNodeRef` to the outer div.
- **Drag handle**: Insert a grip icon button (6-dot pattern) as the first child, receiving `{...attributes, ...listeners}`. Mark it with `data-drag-handle` attribute. Style: `touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500`.
- **Touch guard**: At the top of `handleTouchStart`, check `e.target.closest('[data-drag-handle]')` -- if truthy, return early (don't start swipe tracking). This isolates drag from swipe.
- **Transform merge**: When `isDragging` or transform is active, apply the sortable transform via `CSS.Transform.toString(transform)`. When `swipeX` is active, apply swipe translateX. They're mutually exclusive due to the touch guard.
- **Visual feedback**: When `isDragging`, add `opacity-50 shadow-lg bg-white rounded-lg z-10` classes.

### 3. `TaskList.jsx` -- DnD orchestrator

- Import `DndContext`, `closestCenter`, `PointerSensor`, `TouchSensor`, `useSensor`, `useSensors` from `@dnd-kit/core`.
- Import `SortableContext`, `verticalListSortingStrategy`, `arrayMove` from `@dnd-kit/sortable`.
- Configure sensors:
  - PointerSensor: `activationConstraint: { distance: 5 }` (prevents accidental drags on click)
  - TouchSensor: `activationConstraint: { delay: 150, tolerance: 5 }` (hold before drag on mobile)
- Accept new `onReorder` prop.
- `onDragEnd({ active, over })`: guard if no `over` or same position; use `arrayMove` to compute new order; call `onReorder(reorderedTasks.map(t => t.id))`.
- Render: `DndContext > SortableContext(items=tasks.map(t=>t.id), strategy=verticalListSortingStrategy) > div.divide-y > TaskRow map`.

### 4. `PlannerPage.jsx` -- wiring

- Destructure `reorderTasks` from `useTasks()`.
- Add `handleReorder(orderedIds)` callback: builds `orderedIds.map((id, i) => ({ id, position: i }))`, calls `reorderTasks(updates)`, on error sets `actionError`, then `fetchTasks(currentParentId)`.
- Pass `onReorder={handleReorder}` to `<TaskList>`.

## Position strategy with "Show done" toggle

| Show done | Behavior |
|-----------|----------|
| ON | All tasks visible and reorderable. Positions 0..N-1 assigned cleanly. |
| OFF | Only non-done tasks visible. Reorder assigns 0..M-1 to visible tasks. Done tasks keep their old positions. |

This is the simplest correct approach. No special-case logic needed.

## Verification

1. `npm install` -- deps resolve without errors
2. `CI=true npm run build` -- no build errors
3. Desktop: grab the grip handle, drag task up/down, release -- task stays in new position after page refresh
4. Mobile: grip handle starts drag; swiping on the row body still navigates/deletes
5. Export after reorder -- YAML reflects new order
6. Deploy and test live
