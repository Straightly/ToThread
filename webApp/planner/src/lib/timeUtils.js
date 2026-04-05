// --- Week boundary helpers ---

export function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? 6 : day - 1; // days since Monday
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

export function formatWeekLabel(weekStart) {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 6); // Sunday
  const opts = { month: 'short', day: 'numeric' };
  const startStr = weekStart.toLocaleDateString(undefined, opts);
  const endStr = end.toLocaleDateString(undefined, { ...opts, year: 'numeric' });
  return `${startStr} - ${endStr}`;
}

// --- Duration helpers ---

export function computeElapsedMs(startedAt) {
  if (!startedAt) return 0;
  return Math.max(0, Date.now() - new Date(startedAt).getTime());
}

export function formatDuration(ms) {
  if (ms <= 0) return '0:00:00';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function msToHours(ms) {
  return Math.round((ms / 3600000) * 10) / 10;
}

// --- Week clipping ---

export function clipEntryToWeek(startedAt, endedAt, weekStart, weekEnd) {
  const s = new Date(startedAt).getTime();
  const e = new Date(endedAt).getTime();
  const ws = weekStart.getTime();
  const we = weekEnd.getTime();
  const clippedStart = Math.max(s, ws);
  const clippedEnd = Math.min(e, we);
  if (clippedStart >= clippedEnd) return 0;
  return clippedEnd - clippedStart;
}

// --- Aggregation ---

export function findLowestContinuousAncestor(taskId, taskMap) {
  let current = taskMap.get(taskId);
  if (!current) return null;
  // Walk up from the task itself, find the FIRST (lowest/deepest) Continuous
  // Check the task itself first
  if (current.status === 'Continuous') return current;
  let depth = 0;
  while (current.parent_id && depth < 100) {
    const parent = taskMap.get(current.parent_id);
    if (!parent) break;
    if (parent.status === 'Continuous') return parent;
    current = parent;
    depth++;
  }
  return null;
}

export function aggregateWeeklyTime(entries, runningSegment, weekStart, weekEnd, taskMap) {
  const byTask = new Map(); // taskId -> { taskTitle, actualMs }
  let unallocatedWorkMs = 0;
  let sleepingMs = 0;
  let transitioningMs = 0;

  function addEntry(mode, taskId, startedAt, endedAt) {
    const ms = clipEntryToWeek(startedAt, endedAt, weekStart, weekEnd);
    if (ms <= 0) return;

    if (mode === 'sleeping') {
      sleepingMs += ms;
    } else if (mode === 'transitioning') {
      transitioningMs += ms;
    } else if (mode === 'working') {
      const ancestor = taskId ? findLowestContinuousAncestor(taskId, taskMap) : null;
      if (ancestor) {
        const existing = byTask.get(ancestor.id);
        if (existing) {
          existing.actualMs += ms;
        } else {
          byTask.set(ancestor.id, { taskTitle: ancestor.title, actualMs: ms });
        }
      } else {
        unallocatedWorkMs += ms;
      }
    }
  }

  // Process completed entries
  for (const entry of entries) {
    addEntry(entry.mode, entry.task_id, entry.started_at, entry.ended_at);
  }

  // Process the currently running segment (if it overlaps this week)
  if (runningSegment && runningSegment.started_at) {
    const now = new Date().toISOString();
    addEntry(runningSegment.mode, runningSegment.task_id, runningSegment.started_at, now);
  }

  const totalTrackedMs = sleepingMs + transitioningMs + unallocatedWorkMs +
    Array.from(byTask.values()).reduce((sum, v) => sum + v.actualMs, 0);

  return { byTask, unallocatedWorkMs, sleepingMs, transitioningMs, totalTrackedMs };
}

// --- Transition validation ---

export function isNoOp(currentMode, currentTaskId, action, newTaskId) {
  if (action === 'stop' && currentMode === 'transitioning') return true;
  if (action === 'start_sleep' && currentMode === 'sleeping') return true;
  if (action === 'start_work' && currentMode === 'working' && currentTaskId === newTaskId) return true;
  return false;
}

// --- Week start as ISO date string (for DB queries) ---

export function weekStartToISO(weekStart) {
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
