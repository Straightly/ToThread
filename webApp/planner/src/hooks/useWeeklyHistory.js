import { useState, useEffect, useCallback, useMemo } from 'react';
import insforge from '../insforge';
import { getWeekStart, getWeekEnd, weekStartToISO, aggregateWeeklyTime } from '../lib/timeUtils';
import { buildTaskMap } from '../lib/taskTree';

export function useWeeklyHistory(userId) {
  const [historyWeeks, setHistoryWeeks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentWeekStart = useMemo(() => getWeekStart(new Date()), []);

  const fetchHistory = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      // Fetch all tasks for hierarchy walking
      const { data: allTasks } = await insforge.database
        .from('tasks').select('*').eq('user_id', userId).is('deleted_at', null);
      const taskMap = buildTaskMap(allTasks || []);

      // Compute the start of 12 weeks ago
      const historyStart = new Date(currentWeekStart);
      historyStart.setDate(historyStart.getDate() - 12 * 7);

      // Fetch all time entries, budgets, and allocations in the range
      const [entriesRes, budgetsRes, allocsRes] = await Promise.all([
        insforge.database.from('time_entries').select('*').eq('user_id', userId)
          .gte('ended_at', historyStart.toISOString())
          .lt('started_at', currentWeekStart.toISOString()),
        insforge.database.from('weekly_budgets').select('*').eq('user_id', userId)
          .gte('week_start', weekStartToISO(historyStart))
          .lt('week_start', weekStartToISO(currentWeekStart))
          .order('week_start', { ascending: false }),
        insforge.database.from('weekly_allocations').select('*').eq('user_id', userId)
          .gte('week_start', weekStartToISO(historyStart))
          .lt('week_start', weekStartToISO(currentWeekStart)),
      ]);

      const allEntries = entriesRes.data || [];
      const budgets = budgetsRes.data || [];
      const allocs = allocsRes.data || [];

      // Build weekly summaries, walking backwards from the week before current
      const weeks = [];
      const prevWeek = new Date(currentWeekStart);
      prevWeek.setDate(prevWeek.getDate() - 7);

      for (let i = 0; i < 12; i++) {
        const ws = new Date(prevWeek);
        ws.setDate(ws.getDate() - i * 7);
        const we = getWeekEnd(ws);
        const wsISO = weekStartToISO(ws);

        const budgetRow = budgets.find(b => b.week_start === wsISO);
        const weekAllocs = allocs.filter(a => a.week_start === wsISO);
        const weekEntries = allEntries.filter(e => {
          const eEnd = new Date(e.ended_at).getTime();
          const eStart = new Date(e.started_at).getTime();
          return eEnd > ws.getTime() && eStart < we.getTime();
        });

        // Skip weeks with no data at all
        if (!budgetRow && weekAllocs.length === 0 && weekEntries.length === 0) continue;

        const actuals = aggregateWeeklyTime(weekEntries, null, ws, we, taskMap);

        weeks.push({
          weekStart: ws,
          budgetHours: budgetRow?.total_hours ?? null,
          allocations: weekAllocs.map(a => {
            const task = taskMap.get(a.task_id);
            const actual = actuals.byTask.get(a.task_id);
            return {
              taskId: a.task_id,
              taskTitle: task?.title || '(deleted)',
              plannedHours: Number(a.planned_hours),
              actualHours: actual ? Math.round((actual.actualMs / 3600000) * 10) / 10 : 0,
            };
          }),
          // Include continuous tasks that have actual time but no allocation
          unplannedActuals: Array.from(actuals.byTask.entries())
            .filter(([id]) => !weekAllocs.some(a => a.task_id === id))
            .map(([id, val]) => ({
              taskId: id,
              taskTitle: val.taskTitle,
              plannedHours: 0,
              actualHours: Math.round((val.actualMs / 3600000) * 10) / 10,
            })),
          sleepingHours: Math.round((actuals.sleepingMs / 3600000) * 10) / 10,
          transitioningHours: Math.round((actuals.transitioningMs / 3600000) * 10) / 10,
          unallocatedWorkHours: Math.round((actuals.unallocatedWorkMs / 3600000) * 10) / 10,
        });
      }

      setHistoryWeeks(weeks);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId, currentWeekStart]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  return { historyWeeks, loading, error, refresh: fetchHistory };
}
