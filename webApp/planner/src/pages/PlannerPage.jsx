import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTasks } from '../hooks/useTasks';
import { canMarkDone, isDone, isContinuous } from '../lib/taskTree';
import { buildTaskTrees, tasksToYaml, downloadYaml } from '../lib/exportTask';
import { importTasksFromYaml } from '../lib/importTask';
import insforge from '../insforge';
import AppShell from '../components/layout/AppShell';
import NavBar from '../components/layout/NavBar';
import TaskList from '../components/tasks/TaskList';
import TaskDetailOverlay from '../components/tasks/TaskDetailOverlay';
import AddTaskButton from '../components/tasks/AddTaskButton';

export default function PlannerPage() {
  const { user } = useAuth();
  const location = useLocation();
  const { tasks, childCounts, loading, error, fetchTasks, addTask, updateTask, softDeleteTask, markDone, getTaskById, reorderTasks } = useTasks(user?.id);

  // Navigation stack: array of { id, title } objects. Empty = root level.
  const [navStack, setNavStack] = useState(location.state?.initialNavStack || []);
  const [showFinished, setShowFinished] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const currentParentId = navStack.length > 0 ? navStack[navStack.length - 1].id : null;

  useEffect(() => {
    if (location.state?.initialNavStack) {
      window.history.replaceState({}, '');
    }
  }, []);

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

  const handleExport = useCallback(async () => {
    setActionError(null);
    setExporting(true);
    try {
      const trees = await buildTaskTrees(visibleTasks, insforge, showFinished);
      const yaml = tasksToYaml(trees);
      const name = navStack.length > 0
        ? navStack[navStack.length - 1].title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : 'project-plan';
      downloadYaml(yaml, `${name}.yaml`);
    } catch (err) {
      setActionError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [visibleTasks, showFinished, navStack]);

  const handleImport = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setActionError(null);
      setImporting(true);
      try {
        const text = await file.text();
        await importTasksFromYaml(text, insforge, user.id, currentParentId);
        fetchTasks(currentParentId);
      } catch (err) {
        setActionError(err.message || 'Import failed');
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }, [user, currentParentId, fetchTasks]);

  const handleReorder = useCallback(async (orderedIds) => {
    setActionError(null);
    const updates = orderedIds.map((id, i) => ({ id, position: i }));
    const result = await reorderTasks(updates);
    if (result.error) {
      setActionError(result.error);
    }
    fetchTasks(currentParentId);
  }, [reorderTasks, currentParentId, fetchTasks]);

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <NavBar
          navStack={navStack}
          onNavigateBack={navigateBack}
          onNavigateTo={navigateTo}
        />

        <div className="flex items-center justify-between mt-4 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-medium text-gray-900">
              {navStack.length > 0 ? navStack[navStack.length - 1].title : 'Project Plan'}
            </h2>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Import tasks from YAML"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5m0 0L7 8m5-5v12" />
              </svg>
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50"
              title="Export visible tasks as YAML"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
              </svg>
              {exporting ? 'Exporting...' : 'Export'}
            </button>
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
          onReorder={handleReorder}
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
