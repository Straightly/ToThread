import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTodoTasks } from '../hooks/useTodoTasks';
import AppShell from '../components/layout/AppShell';
import TimerBar from '../components/timer/TimerBar';
import TodoList from '../components/tasks/TodoList';
import TaskDetailOverlay from '../components/tasks/TaskDetailOverlay';

export default function TodoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const {
    todoItems,
    miscTodosTask,
    miscTodoItems,
    loading,
    error,
    fetchAllTasks,
    markDone,
    softDeleteTask,
    getTaskById,
    updateTask,
  } = useTodoTasks(user?.id);

  const [detailTask, setDetailTask] = useState(null);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    fetchAllTasks();
  }, [fetchAllTasks]);

  const handleNavigateToPlanner = useCallback((task, parentChain) => {
    navigate('/planner', { state: { initialNavStack: parentChain } });
  }, [navigate]);

  const handleMarkDone = useCallback(async (taskId) => {
    setActionError(null);
    const result = await markDone(taskId);
    if (result.error) {
      setActionError(result.error);
    }
  }, [markDone]);

  const handleDelete = useCallback(async (taskId) => {
    setActionError(null);
    const result = await softDeleteTask(taskId);
    if (result.error) {
      setActionError(result.error);
    }
  }, [softDeleteTask]);

  const handleOpenDetail = useCallback(async (task) => {
    const result = await getTaskById(task.id);
    if (result.data) {
      setDetailTask(result.data);
    }
  }, [getTaskById]);

  const handleSaveDetail = useCallback(async (taskId, fields) => {
    setActionError(null);
    const result = await updateTask(taskId, fields);
    if (result.error) {
      setActionError(result.error);
      return false;
    }
    setDetailTask(null);
    fetchAllTasks();
    return true;
  }, [updateTask, fetchAllTasks]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <h2 className="text-lg font-medium text-gray-900 mb-3">Tasks To Do</h2>

        <TimerBar />

        {actionError && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {actionError}
            <button onClick={() => setActionError(null)} className="ml-2 text-red-500 hover:text-red-700">&times;</button>
          </div>
        )}

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        <TodoList
          todoItems={todoItems}
          miscTodosTask={miscTodosTask}
          miscTodoItems={miscTodoItems}
          loading={loading}
          onNavigateToPlanner={handleNavigateToPlanner}
          onMarkDone={handleMarkDone}
          onDelete={handleDelete}
          onOpenDetail={handleOpenDetail}
        />

        {detailTask && (
          <TaskDetailOverlay
            task={detailTask}
            onSave={handleSaveDetail}
            onClose={() => setDetailTask(null)}
          />
        )}
      </div>
    </AppShell>
  );
}
