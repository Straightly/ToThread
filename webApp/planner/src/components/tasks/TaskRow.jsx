import { useState, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import StatusBadge from './StatusBadge';
import SubtaskBadge from './SubtaskBadge';
import StartWorkButton from '../timer/StartWorkButton';
import { isDone, isContinuous } from '../../lib/taskTree';

export default function TaskRow({ task, childCount, taskAbove, isRootLevel, onNavigateInto, onMarkDone, onDelete, onOpenDetail, onIndent, onOutdent }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const taskIsDone = isDone(task);
  const hasChildren = childCount.total > 0;
  const showDoneBtn = !taskIsDone && !isContinuous(task) && (!hasChildren || childCount.unfinished === 0);

  function handleTouchStart(e) {
    // Don't start swipe tracking if touching the drag handle or indent buttons
    if (e.target.closest('[data-drag-handle]') || e.target.closest('[data-indent-btn]')) return;
    touchStartRef.current = e.touches[0].clientX;
    setSwipeX(0);
  }

  function handleTouchMove(e) {
    if (touchStartRef.current === null) return;
    const diff = e.touches[0].clientX - touchStartRef.current;
    setSwipeX(diff);
  }

  function handleTouchEnd() {
    if (swipeX > 80) {
      onNavigateInto(task);
    } else if (swipeX < -80) {
      setConfirmDelete(true);
    }
    setSwipeX(0);
    touchStartRef.current = null;
  }

  // Compose transforms: sortable (vertical) and swipe (horizontal) are mutually exclusive
  const sortableStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const swipeStyle = swipeX ? { transform: `translateX(${swipeX * 0.3}px)` } : {};
  const style = swipeX ? swipeStyle : sortableStyle;

  return (
    <div
      ref={setNodeRef}
      className={`py-3 flex items-center gap-3 group ${
        isDragging ? 'opacity-50 shadow-lg bg-white rounded-lg z-10 relative' : ''
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={style}
    >
      {/* Drag handle */}
      <button
        type="button"
        data-drag-handle
        className="p-1 touch-none cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 shrink-0"
        aria-label="Reorder"
        {...attributes}
        {...listeners}
      >
        <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="5" cy="3" r="1.5" />
          <circle cx="11" cy="3" r="1.5" />
          <circle cx="5" cy="8" r="1.5" />
          <circle cx="11" cy="8" r="1.5" />
          <circle cx="5" cy="13" r="1.5" />
          <circle cx="11" cy="13" r="1.5" />
        </svg>
      </button>

      {/* Outdent (move up a level) — placeholder when at root */}
      {!isRootLevel ? (
        <button
          type="button"
          data-indent-btn
          onClick={() => onOutdent(task.id)}
          className="p-1 text-gray-300 hover:text-gray-500 shrink-0 transition"
          aria-label="Move up a level"
          title="Move up a level"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      ) : (
        <span className="p-1 shrink-0 w-3.5 h-3.5 box-content" />
      )}

      {/* Indent (make subtask of task above) — placeholder when first */}
      {taskAbove ? (
        <button
          type="button"
          data-indent-btn
          onClick={() => onIndent(task.id, taskAbove.id)}
          className="p-1 text-gray-300 hover:text-gray-500 shrink-0 transition"
          aria-label="Make subtask of task above"
          title="Make subtask of task above"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : (
        <span className="p-1 shrink-0 w-3.5 h-3.5 box-content" />
      )}

      {/* Title area - clickable to open detail */}
      <button
        onClick={() => onOpenDetail(task)}
        className={`flex-1 text-left text-sm truncate ${
          taskIsDone ? 'line-through text-gray-400' : 'text-gray-900'
        }`}
      >
        {task.title}
      </button>

      <div className="flex items-center gap-2 shrink-0">
        <StatusBadge status={task.status} />

        <StartWorkButton taskId={task.id} taskTitle={task.title} />

        <SubtaskBadge total={childCount.total} unfinished={childCount.unfinished} />

        {/* Navigate into subtasks */}
        <button
          onClick={() => onNavigateInto(task)}
          className="p-1 text-gray-400 hover:text-blue-600 transition"
          title="View subtasks"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Mark done button */}
        {showDoneBtn && (
          <button
            onClick={() => onMarkDone(task.id)}
            className="p-1 text-gray-400 hover:text-green-600 transition"
            title="Mark done"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}

        {/* Delete button (desktop) */}
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => { onDelete(task.id); setConfirmDelete(false); }}
              className="text-xs text-red-600 font-medium hover:text-red-800"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
