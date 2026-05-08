import { useState, useCallback } from 'react';
import insforge from '../insforge';
import { countChildren, canMarkDone, canSoftDelete, isDoneStatus } from '../lib/taskTree';

async function ensureParentReopened(parentId) {
  if (!parentId) return;
  const { data: parent, error: fetchError } = await insforge.database
    .from('tasks')
    .select('id, status')
    .eq('id', parentId)
    .maybeSingle();
  if (fetchError || !parent) return;
  if (!isDoneStatus(parent.status)) return;
  await insforge.database
    .from('tasks')
    .update({ status: 'In Progress' })
    .eq('id', parentId);
}

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
    // If we just created a subtask under a "Done" parent, reopen the parent so it can be
    // explicitly completed again after the new subtask is handled.
    if (parentId) {
      try {
        await ensureParentReopened(parentId);
      } catch {
        // Best-effort: don't fail the subtask creation if reopening fails.
      }
    }
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

  const reorderTasks = useCallback(async (updates) => {
    // Optimistic: update local state immediately
    const posMap = new Map(updates.map(u => [u.id, u.position]));
    setTasks(prev => {
      const next = prev.map(t => posMap.has(t.id) ? { ...t, position: posMap.get(t.id) } : t);
      next.sort((a, b) => a.position - b.position);
      return next;
    });

    // Persist to DB
    const results = await Promise.all(
      updates.map(u =>
        insforge.database.from('tasks').update({ position: u.position }).eq('id', u.id)
      )
    );
    const failed = results.find(r => r.error);
    if (failed) return { error: failed.error.message };
    return { success: true };
  }, []);

  const indentTask = useCallback(async (taskId, newParentId) => {
    // Get next position among new parent's children
    const { data: siblings } = await insforge.database
      .from('tasks')
      .select('position')
      .eq('parent_id', newParentId)
      .is('deleted_at', null)
      .order('position', { ascending: false })
      .limit(1);
    const nextPosition = siblings?.length > 0 ? siblings[0].position + 1 : 0;

    const { error } = await insforge.database
      .from('tasks')
      .update({ parent_id: newParentId, position: nextPosition })
      .eq('id', taskId);
    if (error) return { error: error.message };
    try {
      await ensureParentReopened(newParentId);
    } catch {
      // Best-effort; indent is already done.
    }
    return { success: true };
  }, []);

  const outdentTask = useCallback(async (taskId, currentParentId) => {
    // Get current parent to find grandparent and parent's position
    const { data: parent, error: parentError } = await insforge.database
      .from('tasks')
      .select('id, parent_id, position')
      .eq('id', currentParentId)
      .single();
    if (parentError) return { error: parentError.message };

    const grandparentId = parent.parent_id;

    // Shift siblings of parent that come after it to make room
    let shiftQuery = insforge.database
      .from('tasks')
      .select('id, position')
      .is('deleted_at', null)
      .gt('position', parent.position);
    if (grandparentId === null) {
      shiftQuery = shiftQuery.is('parent_id', null);
    } else {
      shiftQuery = shiftQuery.eq('parent_id', grandparentId);
    }
    const { data: toShift } = await shiftQuery;
    if (toShift?.length > 0) {
      await Promise.all(
        toShift.map(s =>
          insforge.database.from('tasks').update({ position: s.position + 1 }).eq('id', s.id)
        )
      );
    }

    // Move the task to grandparent level, right after former parent
    const { error } = await insforge.database
      .from('tasks')
      .update({ parent_id: grandparentId, position: parent.position + 1 })
      .eq('id', taskId);
    if (error) return { error: error.message };
    return { success: true };
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
    reorderTasks,
    indentTask,
    outdentTask,
  };
}
