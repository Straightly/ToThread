export default function UserTable({ users, loading, currentUserId, onToggleRole }) {
  if (loading) {
    return <div className="py-8 text-center text-gray-400 text-sm">Loading users...</div>;
  }

  if (users.length === 0) {
    return <div className="py-8 text-center text-gray-400 text-sm">No users found.</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Admin</th>
            <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {users.map(u => (
            <tr key={u.id} className="hover:bg-gray-50">
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900">
                  {u.name || 'No name'}
                  {u.id === currentUserId && (
                    <span className="ml-2 text-xs text-gray-400">(you)</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </td>
              <td className="text-center px-4 py-3">
                <input
                  type="checkbox"
                  checked={u.roles.includes('admin')}
                  onChange={() => onToggleRole(u.id, 'admin', u.roles.includes('admin'))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="text-center px-4 py-3">
                <input
                  type="checkbox"
                  checked={u.roles.includes('user')}
                  onChange={() => onToggleRole(u.id, 'user', u.roles.includes('user'))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
