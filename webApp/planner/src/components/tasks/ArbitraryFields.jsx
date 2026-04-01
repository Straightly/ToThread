import { useState } from 'react';

export default function ArbitraryFields({ fields, onChange }) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = Object.entries(fields || {});

  function handleAdd() {
    const key = newKey.trim();
    if (!key) return;
    onChange({ ...fields, [key]: newValue });
    setNewKey('');
    setNewValue('');
  }

  function handleUpdate(key, value) {
    onChange({ ...fields, [key]: value });
  }

  function handleRemove(key) {
    const next = { ...fields };
    delete next[key];
    onChange(next);
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">Custom Fields</label>

      {entries.length > 0 && (
        <div className="space-y-2 mb-3">
          {entries.map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-500 w-24 truncate shrink-0">{key}</span>
              <input
                type="text"
                value={value}
                onChange={e => handleUpdate(key, e.target.value)}
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded
                  focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => handleRemove(key)}
                className="text-gray-300 hover:text-red-500 text-sm"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={e => setNewKey(e.target.value)}
          placeholder="Key"
          className="w-24 px-2 py-1 text-sm border border-gray-200 rounded
            focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="Value"
          className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded
            focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="button"
          onClick={handleAdd}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          Add
        </button>
      </div>
    </div>
  );
}
