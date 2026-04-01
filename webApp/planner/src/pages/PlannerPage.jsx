import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { canMarkDone, isDone, isContinuous } from '../lib/taskTree';
import AppShell from '../components/layout/AppShell';
import NavBar from '../components/layout/NavBar';
import TaskList from '../components/tasks/TaskList';
import TaskDetailOverlay from '../components/tasks/TaskDetailOverlay';
import AddTaskButton from '../components/tasks/AddTaskButton';

export default function PlannerPage() {
  const { user } = useAuth();
  const { tasks, childCounts, loading, error, fetchTasks, addTask, updateTask, softDeleteTask, markDone, getTaskById } = useTasks(user?.id);

  // Navigation stack: array of { id, title } objects. Empty = root level.
  const [navStack, setNavStack] = useState([]);
  const [showFinished, setShowFinished] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [actionError, setActionError] = useState(null);

  const currentParentId = navStack.length > 0 ? navStack[navStack.length - 1].id : null;

  useEffect(() => {
    fetchTasks(currentParentId);
  }, [fetchTasks, currentParentId]);

  const navigateInto = useCallback((task) => {
    setNavStack(prev => [...prev, { id: task.id, title: task.title }]);
  }, []);

  const navigateBack = useCallback(() => {
    setNavStack(prev => prev.slice(0, -1));
  }, []);

  const navigateTo = useCallback((index) => {
    // Navigate to a specific breadcrumb level
    if (index < 0) {
      setNavStack([]);
    } else {
      setNavStack(prev => prev.slice(0, index + 1));
    }
  }, []);

  const handleAddTask = useCallback(async (title) => {
    setActionError(null);
    const result = await addTask(title, currentParentId);
    if (result.error) {
      setActionError(result.error);
    } else {
      fetchTasks(currentParentId);
    }
  }, [addTask, currentParentId, fetchTasks]);

  const handleMarkDone = useCallback(async (taskId) => {
    setActionError(null);
    const result = await markDone(taskId);
    if (result.error) {
      setActionError(result.error);
    } else {
      fetchTasks(currentParentId);
    }
  }, [markDone, currentParentId, fetchTasks]);

  const handleDelete = useCallback(async (taskId) => {
    setActionError(null);
    const result = await softDeleteTask(taskId);
    if (result.error) {
      setActionError(result.error);
    } else {
      fetchTasks(currentParentId);
    }
  }, [softDeleteTask, currentParentId, fetchTasks]);

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
    fetchTasks(currentParentId);
    return true;
  }, [updateTask, currentParentId, fetchTasks]);

  const visibleTasks = showFinished
    ? tasks
    : tasks.filter(t => !isDone(t));

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <NavBar
          navStack={navStack}
          onNavigateBack={navigateBack}
          onNavigateTo={navigateTo}
        />

        <div className="flex items-center justify-between mt-4 mb-3">
          <h2 className="text-lg font-medium text-gray-900">
            {navStack.length > 0 ? navStack[navStack.length - 1].title : 'Project Plan'}
          </h2>
          <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showFinished}
              onChange={e => setShowFinished(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show done
          </label>
        </div>

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

        <TaskList
          tasks={visibleTasks}
          childCounts={childCounts}
          loading={loading}
          onNavigateInto={navigateInto}
          onMarkDone={handleMarkDone}
          onDelete={handleDelete}
          onOpenDetail={handleOpenDetail}
        />

        <AddTaskButton onAdd={handleAddTask} />

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
