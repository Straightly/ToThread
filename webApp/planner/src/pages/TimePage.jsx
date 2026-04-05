import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useWeeklyTime } from '../hooks/useWeeklyTime';
import { useWeeklyHistory } from '../hooks/useWeeklyHistory';
import { formatWeekLabel, msToHours } from '../lib/timeUtils';
import AppShell from '../components/layout/AppShell';
import TimerBar from '../components/timer/TimerBar';

export default function TimePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { weekStart, budget, allocations, actuals, continuousTasks, loading, error, saveBudget, saveAllocation } = useWeeklyTime(user?.id);
  const { historyWeeks, loading: historyLoading } = useWeeklyHistory(user?.id);

  const [budgetInput, setBudgetInput] = useState('');
  const [budgetInitialized, setBudgetInitialized] = useState(false);

  // Initialize budget input from DB value once loaded
  if (!budgetInitialized && !loading && budget !== undefined) {
    setBudgetInput(budget?.total_hours != null ? String(budget.total_hours) : '');
    setBudgetInitialized(true);
  }

  const handleBudgetBlur = useCallback(() => {
    const val = parseFloat(budgetInput);
    if (!isNaN(val) && val >= 0) {
      saveBudget(val);
    }
  }, [budgetInput, saveBudget]);

  const allocatedTotal = allocations.reduce((sum, a) => sum + Number(a.planned_hours), 0);

  // Build allocation lookup
  const allocMap = {};
  for (const a of allocations) allocMap[a.task_id] = a;

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto px-4 py-4">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-3"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Tasks To Do
        </button>

        <TimerBar />

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {/* Current Week Section */}
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">
            This Week ({formatWeekLabel(weekStart)})
          </h2>

          {/* Budget */}
          <div className="flex items-center gap-2 mb-4">
            <label className="text-sm text-gray-600">Budget:</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={handleBudgetBlur}
              placeholder="hours"
              className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-400">hours</span>
          </div>

          {loading ? (
            <div className="text-sm text-gray-400">Loading...</div>
          ) : (
            <>
              {/* Allocation Table */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-gray-600 font-medium">Continuous Task</th>
                      <th className="text-right px-3 py-2 text-gray-600 font-medium w-24">Planned</th>
                      <th className="text-right px-3 py-2 text-gray-600 font-medium w-24">Actual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {continuousTasks.map(task => {
                      const alloc = allocMap[task.id];
                      const actual = actuals.byTask.get(task.id);
                      return (
                        <AllocationRow
                          key={task.id}
                          taskId={task.id}
                          taskTitle={task.title}
                          plannedHours={alloc ? Number(alloc.planned_hours) : ''}
                          actualHours={actual ? msToHours(actual.actualMs) : 0}
                          onSave={saveAllocation}
                        />
                      );
                    })}
                    {continuousTasks.length === 0 && (
                      <tr><td colSpan={3} className="px-3 py-3 text-gray-400 text-center">No continuous tasks</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-gray-50 text-sm">
                    <tr className="border-t border-gray-200">
                      <td className="px-3 py-2 font-medium text-gray-700">Allocated total</td>
                      <td className="text-right px-3 py-2 font-medium text-gray-700">{allocatedTotal > 0 ? `${allocatedTotal}h` : '-'}</td>
                      <td className="text-right px-3 py-2"></td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 text-gray-500">Unallocated work</td>
                      <td className="text-right px-3 py-1.5"></td>
                      <td className="text-right px-3 py-1.5 text-gray-500">{msToHours(actuals.unallocatedWorkMs)}h</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 text-gray-500">Sleeping</td>
                      <td className="text-right px-3 py-1.5"></td>
                      <td className="text-right px-3 py-1.5 text-gray-500">{msToHours(actuals.sleepingMs)}h</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-1.5 text-gray-500">Transitioning</td>
                      <td className="text-right px-3 py-1.5"></td>
                      <td className="text-right px-3 py-1.5 text-gray-500">{msToHours(actuals.transitioningMs)}h</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          )}
        </div>

        {/* History Section */}
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-3">History</h2>
          {historyLoading ? (
            <div className="text-sm text-gray-400">Loading history...</div>
          ) : historyWeeks.length === 0 ? (
            <div className="text-sm text-gray-400">No past weeks to display.</div>
          ) : (
            <div className="space-y-4">
              {historyWeeks.map((week) => (
                <HistoryWeek key={week.weekStart.toISOString()} week={week} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function AllocationRow({ taskId, taskTitle, plannedHours, actualHours, onSave }) {
  const [value, setValue] = useState(plannedHours !== '' ? String(plannedHours) : '');

  const handleBlur = () => {
    const val = parseFloat(value);
    if (!isNaN(val) && val >= 0) {
      onSave(taskId, val);
    }
  };

  return (
    <tr>
      <td className="px-3 py-2 text-gray-900 truncate max-w-[200px]">{taskTitle}</td>
      <td className="text-right px-3 py-2">
        <input
          type="number"
          min="0"
          step="0.5"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="-"
          className="w-16 px-1.5 py-0.5 text-sm text-right border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </td>
      <td className="text-right px-3 py-2 text-gray-600">{actualHours}h</td>
    </tr>
  );
}

function HistoryWeek({ week }) {
  const allTasks = [...week.allocations, ...week.unplannedActuals];

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-3 py-2 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{formatWeekLabel(week.weekStart)}</span>
        {week.budgetHours != null && (
          <span className="text-xs text-gray-500">Budget: {week.budgetHours}h</span>
        )}
      </div>
      <table className="w-full text-sm">
        <tbody className="divide-y divide-gray-100">
          {allTasks.map((item) => (
            <tr key={item.taskId}>
              <td className="px-3 py-1.5 text-gray-700 truncate max-w-[200px]">{item.taskTitle}</td>
              <td className="text-right px-3 py-1.5 text-gray-500 w-20">
                {item.plannedHours > 0 ? `${item.plannedHours}h` : '-'}
              </td>
              <td className="text-right px-3 py-1.5 text-gray-600 w-20">{item.actualHours}h</td>
            </tr>
          ))}
          {allTasks.length === 0 && (
            <tr><td colSpan={3} className="px-3 py-1.5 text-gray-400 text-center">No task data</td></tr>
          )}
          <tr className="bg-gray-50">
            <td className="px-3 py-1.5 text-gray-500">Unallocated work</td>
            <td className="text-right px-3 py-1.5"></td>
            <td className="text-right px-3 py-1.5 text-gray-500">{week.unallocatedWorkHours}h</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="px-3 py-1.5 text-gray-500">Sleeping</td>
            <td className="text-right px-3 py-1.5"></td>
            <td className="text-right px-3 py-1.5 text-gray-500">{week.sleepingHours}h</td>
          </tr>
          <tr className="bg-gray-50">
            <td className="px-3 py-1.5 text-gray-500">Transitioning</td>
            <td className="text-right px-3 py-1.5"></td>
            <td className="text-right px-3 py-1.5 text-gray-500">{week.transitioningHours}h</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
