import { useState, useEffect, useCallback, useMemo } from 'react';
import insforge from '../insforge';
import { useTimer } from './useTimer';
import { getWeekStart, getWeekEnd, weekStartToISO, aggregateWeeklyTime } from '../lib/timeUtils';
import { buildTaskMap } from '../lib/taskTree';

export function useWeeklyTime(userId) {
  const { timerState } = useTimer();
  const [allTasks, setAllTasks] = useState([]);
  const [entries, setEntries] = useState([]);
  const [budget, setBudget] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const weekStart = useMemo(() => getWeekStart(new Date()), []);
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);
  const weekStartISO = useMemo(() => weekStartToISO(weekStart), [weekStart]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all in parallel
      const [tasksRes, entriesRes, budgetRes, allocRes] = await Promise.all([
        insforge.database.from('tasks').select('*').eq('user_id', userId).is('deleted_at', null),
        insforge.database.from('time_entries').select('*').eq('user_id', userId)
          .gte('ended_at', weekStart.toISOString())
          .lt('started_at', weekEnd.toISOString()),
        insforge.database.from('weekly_budgets').select('*').eq('user_id', userId)
          .eq('week_start', weekStartISO).maybeSingle(),
        insforge.database.from('weekly_allocations').select('*').eq('user_id', userId)
          .eq('week_start', weekStartISO),
      ]);

      if (tasksRes.error) throw new Error(tasksRes.error.message);
      setAllTasks(tasksRes.data || []);
      setEntries(entriesRes.data || []);
      setBudget(budgetRes.data);
      setAllocations(allocRes.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, weekStart, weekEnd, weekStartISO]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const taskMap = useMemo(() => buildTaskMap(allTasks), [allTasks]);

  const continuousTasks = useMemo(
    () => allTasks.filter(t => t.status === 'Continuous'),
    [allTasks]
  );

  const actuals = useMemo(
    () => aggregateWeeklyTime(entries, timerState, weekStart, weekEnd, taskMap),
    [entries, timerState, weekStart, weekEnd, taskMap]
  );

  const saveBudget = useCallback(async (totalHours) => {
    if (!userId) return;
    const row = { user_id: userId, week_start: weekStartISO, total_hours: totalHours, updated_at: new Date().toISOString() };
    if (budget?.id) {
      await insforge.database.from('weekly_budgets').update({ total_hours: totalHours, updated_at: row.updated_at }).eq('id', budget.id);
      setBudget({ ...budget, total_hours: totalHours });
    } else {
      const { data } = await insforge.database.from('weekly_budgets').insert([row]).select();
      if (data?.[0]) setBudget(data[0]);
    }
  }, [userId, weekStartISO, budget]);

  const saveAllocation = useCallback(async (taskId, plannedHours) => {
    if (!userId) return;
    const existing = allocations.find(a => a.task_id === taskId);
    if (existing) {
      await insforge.database.from('weekly_allocations')
        .update({ planned_hours: plannedHours, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      setAllocations(prev => prev.map(a => a.id === existing.id ? { ...a, planned_hours: plannedHours } : a));
    } else {
      const row = { user_id: userId, week_start: weekStartISO, task_id: taskId, planned_hours: plannedHours };
      const { data } = await insforge.database.from('weekly_allocations').insert([row]).select();
      if (data?.[0]) setAllocations(prev => [...prev, data[0]]);
    }
  }, [userId, weekStartISO, allocations]);

  return {
    weekStart,
    weekEnd,
    budget,
    allocations,
    actuals,
    continuousTasks,
    taskMap,
    loading,
    error,
    saveBudget,
    saveAllocation,
    refresh: fetchData,
  };
}
