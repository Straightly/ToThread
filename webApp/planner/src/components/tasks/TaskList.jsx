import { useMemo, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import TaskRow from './TaskRow';

export default function TaskList({ tasks, childCounts, loading, isRootLevel, onNavigateInto, onMarkDone, onDelete, onOpenDetail, onReorder, onIndent, onOutdent }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const taskIds = useMemo(() => tasks.map(t => t.id), [tasks]);

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = tasks.findIndex(t => t.id === active.id);
    const newIndex = tasks.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(tasks, oldIndex, newIndex);
    onReorder(reordered.map(t => t.id));
  }, [tasks, onReorder]);

  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">Loading tasks...</div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No tasks yet. Add one below.
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="divide-y divide-gray-100">
          {tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              childCount={childCounts[task.id] || { total: 0, unfinished: 0 }}
              taskAbove={index > 0 ? tasks[index - 1] : null}
              isRootLevel={isRootLevel}
              onNavigateInto={onNavigateInto}
              onMarkDone={onMarkDone}
              onDelete={onDelete}
              onOpenDetail={onOpenDetail}
              onIndent={onIndent}
              onOutdent={onOutdent}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
