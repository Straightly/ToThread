import { useTimer } from '../../hooks/useTimer';

export default function StartWorkButton({ taskId, taskTitle }) {
  const { timerState, startWork } = useTimer();

  const isActive = timerState?.mode === 'working' && timerState?.task_id === taskId;

  if (isActive) {
    return (
      <span className="p-1 shrink-0" title="Currently working on this task">
        <span className="block w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); startWork(taskId, taskTitle); }}
      className="p-1 text-gray-400 hover:text-green-600 transition shrink-0"
      title="Start working on this task"
    >
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M8 5v14l11-7z" />
      </svg>
    </button>
  );
}
