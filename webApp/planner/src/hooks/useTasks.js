import { useState, useCallback } from 'react';
import insforge from '../insforge';
import { countChildren, canMarkDone, canSoftDelete } from '../lib/taskTree';

export function useTasks(userId) {
  const [tasks, setTasks] = useState([]);
  const [childCounts, setChildCounts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async (parentId = null) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      let query = insforge.database
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('position', { ascending: true });

      if (parentId === null) {
        query = query.is('parent_id', null);
      } else {
        query = query.eq('parent_id', parentId);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setTasks(data || []);

      // Fetch child counts for each task
      const counts = {};
      for (const task of (data || [])) {
        const { data: children } = await insforge.database
          .from('tasks')
          .select('id, status')
          .eq('parent_id', task.id)
          .is('deleted_at', null);
        counts[task.id] = countChildren(children || []);
      }
      setChildCounts(counts);
    } catch (err) {
      setError(err.message || 'Failed to fetch tasks');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const addTask = useCallback(async (title, parentId = null) => {
    if (!userId) return { error: 'Not authenticated' };
    // Get max position among siblings
    let query = insforge.database
      .from('tasks')
      .select('position')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1);

    if (parentId === null) {
      query = query.is('parent_id', null);
    } else {
      query = query.eq('parent_id', parentId);
    }

    const { data: existing } = await query;
    const nextPosition = existing && existing.length > 0 ? existing[0].position + 1 : 0;

    const { data, error } = await insforge.database
      .from('tasks')
      .insert([{
        user_id: userId,
        parent_id: parentId,
        title,
        position: nextPosition,
        status: 'Pending',
        custom_fields: {},
      }])
      .select();

    if (error) return { error: error.message };
    return { data: data?.[0] };
  }, [userId]);

  const updateTask = useCallback(async (taskId, fields) => {
    const { data, error } = await insforge.database
      .from('tasks')
      .update(fields)
      .eq('id', taskId)
      .select();
    if (error) return { error: error.message };
    return { data: data?.[0] };
  }, []);

  const softDeleteTask = useCallback(async (taskId) => {
    // Check for active children first
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
    return { success: true };
  }, []);

  const markDone = useCallback(async (taskId) => {
    return updateTask(taskId, { status: 'Done' });
  }, [updateTask]);

  const getTaskById = useCallback(async (taskId) => {
    const { data, error } = await insforge.database
      .from('tasks')
      .select('*')
      .eq('id', taskId)
      .single();
    if (error) return { error: error.message };
    return { data };
  }, []);

  return {
    tasks,
    childCounts,
    loading,
    error,
    fetchTasks,
    addTask,
    updateTask,
    softDeleteTask,
    markDone,
    getTaskById,
  };
}
