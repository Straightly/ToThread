import TaskRow from './TaskRow';

export default function TaskList({ tasks, childCounts, loading, onNavigateInto, onMarkDone, onDelete, onOpenDetail }) {
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
    <div className="divide-y divide-gray-100">
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          childCount={childCounts[task.id] || { total: 0, unfinished: 0 }}
          onNavigateInto={onNavigateInto}
          onMarkDone={onMarkDone}
          onDelete={onDelete}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
}
