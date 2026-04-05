import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import insforge from '../insforge';
import { useAuth } from '../hooks/useAuth';
import { isNoOp, computeElapsedMs } from '../lib/timeUtils';

export const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const { user } = useAuth();
  const [timerState, setTimerState] = useState(null); // { mode, task_id, started_at }
  const [taskTitle, setTaskTitle] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef(null);

  // Fetch current timer state from DB
  const fetchTimerState = useCallback(async () => {
    if (!user) return;
    const { data, error } = await insforge.database
      .from('timer_state')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('Failed to fetch timer state:', error);
      return;
    }
    if (data) {
      setTimerState(data);
      // Fetch task title if working
      if (data.mode === 'working' && data.task_id) {
        const { data: task } = await insforge.database
          .from('tasks')
          .select('title')
          .eq('id', data.task_id)
          .maybeSingle();
        setTaskTitle(task?.title || '(unknown task)');
      } else {
        setTaskTitle(null);
      }
    } else {
      // First use: default to transitioning, no DB row yet
      setTimerState({ mode: 'transitioning', task_id: null, started_at: null });
      setTaskTitle(null);
    }
  }, [user]);

  // Initial load
  useEffect(() => {
    if (!user) {
      setTimerState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchTimerState().finally(() => setLoading(false));
  }, [user, fetchTimerState]);

  // 1-second tick for elapsed time
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (timerState?.started_at) {
      const tick = () => setElapsedMs(computeElapsedMs(timerState.started_at));
      tick();
      intervalRef.current = setInterval(tick, 1000);
    } else {
      setElapsedMs(0);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerState?.started_at]);

  // Refresh on tab focus (multi-device sync)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchTimerState();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, fetchTimerState]);

  // Core transition function
  const transition = useCallback(async (newMode, newTaskId = null) => {
    if (!user) return;
    const now = new Date().toISOString();
    const isFirstUse = !timerState?.started_at;

    // Record departing segment (skip on first use - nothing to record)
    if (!isFirstUse && timerState) {
      await insforge.database.from('time_entries').insert([{
        user_id: user.id,
        mode: timerState.mode,
        task_id: timerState.task_id,
        started_at: timerState.started_at,
        ended_at: now,
      }]);
    }

    // Upsert new timer state
    const newState = {
      user_id: user.id,
      mode: newMode,
      task_id: newTaskId,
      started_at: now,
    };
    await insforge.database.from('timer_state').upsert(newState);
    setTimerState(newState);
  }, [user, timerState]);

  const startWork = useCallback(async (taskId, title) => {
    if (!timerState) return;
    if (isNoOp(timerState.mode, timerState.task_id, 'start_work', taskId)) return;
    await transition('working', taskId);
    setTaskTitle(title);
  }, [timerState, transition]);

  const startSleep = useCallback(async () => {
    if (!timerState) return;
    if (isNoOp(timerState.mode, timerState.task_id, 'start_sleep', null)) return;
    await transition('sleeping', null);
    setTaskTitle(null);
  }, [timerState, transition]);

  const stop = useCallback(async () => {
    if (!timerState) return;
    if (isNoOp(timerState.mode, timerState.task_id, 'stop', null)) return;
    await transition('transitioning', null);
    setTaskTitle(null);
  }, [timerState, transition]);

  const value = {
    timerState,
    taskTitle,
    elapsedMs,
    loading,
    startWork,
    startSleep,
    stop,
    refresh: fetchTimerState,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}
