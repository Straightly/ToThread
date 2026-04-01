export default function SubtaskBadge({ total, unfinished }) {
  const allDone = unfinished === 0;
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
      allDone ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'
    }`}>
      {unfinished}/{total}
    </span>
  );
}
