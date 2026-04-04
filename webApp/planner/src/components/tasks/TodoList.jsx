import TodoTaskRow from './TodoTaskRow';

export default function TodoList({ todoItems, loading, onNavigateToPlanner, onMarkDone, onDelete, onOpenDetail }) {
  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">Loading tasks...</div>
    );
  }

  if (todoItems.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No tasks to do. Head to the <a href="/planner" className="text-blue-500 hover:underline">Planner</a> to add tasks.
      </div>
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {todoItems.map(({ task, parentChain, childCount }) => (
        <TodoTaskRow
          key={task.id}
          task={task}
          childCount={childCount}
          parentChain={parentChain}
          onNavigateToPlanner={onNavigateToPlanner}
          onMarkDone={onMarkDone}
          onDelete={onDelete}
          onOpenDetail={onOpenDetail}
        />
      ))}
    </div>
  );
}
