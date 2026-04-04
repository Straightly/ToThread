import { useState, useRef } from 'react';
import StatusBadge from './StatusBadge';
import SubtaskBadge from './SubtaskBadge';
import { isDone, isContinuous } from '../../lib/taskTree';

export default function TodoTaskRow({ task, childCount, parentChain, onNavigateToPlanner, onMarkDone, onDelete, onOpenDetail }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const touchStartRef = useRef(null);

  const taskIsDone = isDone(task);
  const hasChildren = childCount.total > 0;
  const showDoneBtn = !taskIsDone && !isContinuous(task) && (!hasChildren || childCount.unfinished === 0);

  function handleTouchStart(e) {
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
      onNavigateToPlanner(task, parentChain);
    } else if (swipeX < -80) {
      setConfirmDelete(true);
    }
    setSwipeX(0);
    touchStartRef.current = null;
  }

  const style = swipeX ? { transform: `translateX(${swipeX * 0.3}px)` } : {};

  return (
    <div
      className="py-3 group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={style}
    >
      {parentChain.length > 0 && (
        <div className="text-xs text-gray-400 truncate mb-0.5 flex items-center gap-1">
          {parentChain.map((item, i) => (
            <span key={item.id} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <span className="truncate max-w-[120px]">{item.title}</span>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3">
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

          <SubtaskBadge total={childCount.total} unfinished={childCount.unfinished} />

          {/* Navigate to planner */}
          <button
            onClick={() => onNavigateToPlanner(task, parentChain)}
            className="p-1 text-gray-400 hover:text-blue-600 transition"
            title="View in Planner"
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

          {/* Delete button */}
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
    </div>
  );
}
