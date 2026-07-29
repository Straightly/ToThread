import { useState, useCallback, useMemo } from 'react';
import insforge from '../insforge';
import {
  countChildren,
  canSoftDelete,
  buildTaskMap,
  buildChildrenMap,
  computeTodoTasks,
  findTaskByTitle,
  collectDescendants,
  buildParentChain,
} from '../lib/taskTree';

const MISC_TODOS_TITLE = 'Misc Todos';

export function useTodoTasks(userId) {
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAllTasks = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await insforge.database
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('position', { ascending: true });
      if (fetchError) throw fetchError;
      setAllTasks(data || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const taskMap = useMemo(() => buildTaskMap(allTasks), [allTasks]);
  const childrenMap = useMemo(() => buildChildrenMap(allTasks), [allTasks]);
  const miscTodos = useMemo(() => {
    const task = findTaskByTitle(allTasks, childrenMap, MISC_TODOS_TITLE);
    const descendants = task ? collectDescendants(task.id, childrenMap) : [];
    return {
      task,
      descendants,
      subtreeIds: new Set(task ? [task.id, ...descendants.map(item => item.id)] : []),
    };
  }, [allTasks, childrenMap]);
  const todoTasks = useMemo(() => {
    return computeTodoTasks(allTasks, taskMap, childrenMap)
      .filter(task => !miscTodos.subtreeIds.has(task.id));
  }, [allTasks, taskMap, childrenMap, miscTodos]);

  const todoItems = useMemo(() => {
    return todoTasks.map(task => ({
      task,
      parentChain: buildParentChain(task.id, taskMap),
      childCount: countChildren(childrenMap.get(task.id) || []),
    }));
  }, [todoTasks, taskMap, childrenMap]);

  const miscTodoItems = useMemo(() => {
    if (!miscTodos.task) return [];
    return miscTodos.descendants.map(task => {
      const parentChain = buildParentChain(task.id, taskMap);
      const miscRootIndex = parentChain.findIndex(parent => parent.id === miscTodos.task.id);
      return {
        task,
        parentChain: miscRootIndex >= 0 ? parentChain.slice(miscRootIndex + 1) : parentChain,
        childCount: countChildren(childrenMap.get(task.id) || []),
      };
    });
  }, [miscTodos, taskMap, childrenMap]);

  const markDone = useCallback(async (taskId) => {
    const { error } = await insforge.database
      .from('tasks')
      .update({ status: 'Done' })
      .eq('id', taskId)
      .select();
    if (error) return { error: error.message };
    await fetchAllTasks();
    return { success: true };
  }, [fetchAllTasks]);

  const softDeleteTask = useCallback(async (taskId) => {
    const { data: children } = await insforge.database
      .from('tasks')
      .select('id')
      .eq('parent_id', taskId)
      .is('deleted_at', null);
    if (!canSoftDelete(children || [])) {
      return { error: 'Cannot delete task with active subtasks. Delete or archive subtasks first.' };
    }
    const { error } = await insforge.database
      .from('tasks')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', taskId);
    if (error) return { error: error.message };
    await fetchAllTasks();
    return { success: true };
  }, [fetchAllTasks]);

  const getTaskById = useCallback(async (taskId) => {
    const { data, error } = await insforge.database
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    if (error) return { error: error.message };
    return { data };
  }, []);

  const updateTask = useCallback(async (taskId, fields) => {
    const { data, error } = await insforge.database
      .from('tasks')
      .update(fields)
      .eq('id', taskId)
      .select();
    if (error) return { error: error.message };
    return { data: data?.[0] };
  }, []);

  return {
    todoItems,
    miscTodosTask: miscTodos.task,
    miscTodoItems,
    loading,
    error,
    fetchAllTasks,
    markDone,
    softDeleteTask,
    getTaskById,
    updateTask,
  };
}
