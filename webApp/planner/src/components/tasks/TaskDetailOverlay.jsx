import { useState } from 'react';
import { STATUS_VALUES } from '../../lib/constants';
import ArbitraryFields from './ArbitraryFields';

export default function TaskDetailOverlay({ task, onSave, onClose }) {
  const [title, setTitle] = useState(task.title || '');
  const [status, setStatus] = useState(task.status || 'Pending');
  const [description, setDescription] = useState(task.description || '');
  const [result, setResult] = useState(task.result || '');
  const [tags, setTags] = useState((task.tags || []).join(', '));
  const [customFields, setCustomFields] = useState(task.custom_fields || {});
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);

    const parsedTags = tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);

    const fields = {
      title: title.trim(),
      status,
      description: description.trim() || null,
      result: result.trim() || null,
      tags: parsedTags.length > 0 ? parsedTags : null,
      custom_fields: customFields,
    };

    const success = await onSave(task.id, fields);
    setSaving(false);
    if (!success) {
      // Error is handled by parent
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSave}>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Edit Task</h3>
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {STATUS_VALUES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="e.g. frontend, urgent"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Result</label>
              <textarea
                value={result}
                onChange={e => setResult(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                  focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
              />
            </div>

            <ArbitraryFields fields={customFields} onChange={setCustomFields} />
          </div>

          <div className="border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
                hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
