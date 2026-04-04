export default function SubtaskBadge({ total, unfinished }) {
  const allDone = total > 0 && unfinished === 0;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
      total === 0
        ? 'bg-gray-100 text-gray-400'
        : allDone
          ? 'bg-blue-50 text-blue-600'
          : 'bg-red-50 text-red-600'
    }`}>
      {unfinished}/{total}
    </span>
  );
}
