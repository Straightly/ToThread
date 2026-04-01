import { useState } from 'react';

export default function AddTaskButton({ onAdd }) {
  const [isOpen, setIsOpen] = useState(false);
  const [title, setTitle] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setTitle('');
    setIsOpen(false);
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="mt-4 w-full py-2 text-sm text-gray-400 border border-dashed border-gray-300
          rounded-lg hover:text-blue-600 hover:border-blue-300 transition"
      >
        + Add Task
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <input
        type="text"
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Task title"
        autoFocus
        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        type="submit"
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
          hover:bg-blue-700 transition"
      >
        Add
      </button>
      <button
        type="button"
        onClick={() => { setIsOpen(false); setTitle(''); }}
        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </form>
  );
}
