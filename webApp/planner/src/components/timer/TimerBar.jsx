import { useNavigate } from 'react-router-dom';
import { useTimer } from '../../hooks/useTimer';
import { formatDuration } from '../../lib/timeUtils';

export default function TimerBar() {
  const { timerState, taskTitle, elapsedMs, loading, startSleep, stop } = useTimer();
  const navigate = useNavigate();

  if (loading || !timerState) return null;

  const { mode } = timerState;

  const modeConfig = {
    transitioning: { label: 'Transitioning', dotColor: 'bg-gray-400', textColor: 'text-gray-600' },
    sleeping: { label: 'Sleeping', dotColor: 'bg-blue-400', textColor: 'text-blue-600' },
    working: { label: 'Working', dotColor: 'bg-green-500 animate-pulse', textColor: 'text-green-600' },
  };

  const config = modeConfig[mode] || modeConfig.transitioning;

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${config.dotColor}`} />
          <span className={`text-sm font-medium ${config.textColor}`}>
            {config.label}
          </span>
          {mode === 'working' && taskTitle && (
            <span className="text-sm text-gray-500 truncate">
              {taskTitle}
            </span>
          )}
        </div>
        <span className="text-sm font-mono text-gray-700 shrink-0 ml-2">
          {formatDuration(elapsedMs)}
        </span>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          {(mode === 'sleeping' || mode === 'working') && (
            <button
              type="button"
              onClick={stop}
              className="px-3 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
            >
              Stop
            </button>
          )}
          {(mode === 'transitioning' || mode === 'working') && (
            <button
              type="button"
              onClick={startSleep}
              className="px-3 py-1 text-xs font-medium rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
            >
              Sleep
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/time')}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
        >
          Time
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
