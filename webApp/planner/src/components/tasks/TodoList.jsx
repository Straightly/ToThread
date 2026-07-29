import TodoTaskRow from './TodoTaskRow';

export default function TodoList({ todoItems, miscTodosTask, miscTodoItems, loading, onNavigateToPlanner, onMarkDone, onDelete, onOpenDetail }) {
  if (loading) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">Loading tasks...</div>
    );
  }

  if (todoItems.length === 0 && !miscTodosTask) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No tasks to do. Head to the <a href="/planner" className="text-blue-500 hover:underline">Planner</a> to add tasks.
      </div>
    );
  }

  const renderItem = ({ task, parentChain, childCount }) => (
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
  );

  return (
    <>
      {todoItems.length > 0 && (
        <div className="divide-y divide-gray-100">
          {todoItems.map(renderItem)}
        </div>
      )}

      {miscTodosTask && (
        <section className="mt-8 border-t-2 border-amber-200 pt-4">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <h3 className="text-base font-semibold text-amber-900">{miscTodosTask.title}</h3>
            <span className="text-xs text-amber-700">
              {miscTodoItems.length} {miscTodoItems.length === 1 ? 'subtask' : 'subtasks'}
            </span>
          </div>
          {miscTodoItems.length > 0 ? (
            <div className="divide-y divide-amber-100 rounded-lg border border-amber-100 bg-amber-50/40 px-3">
              {miscTodoItems.map(renderItem)}
            </div>
          ) : (
            <div className="rounded-lg border border-amber-100 bg-amber-50/40 px-3 py-6 text-center text-sm text-amber-700">
              No subtasks yet.
            </div>
          )}
        </section>
      )}
    </>
  );
}
