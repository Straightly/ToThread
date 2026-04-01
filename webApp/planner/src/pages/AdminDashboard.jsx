import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAdminUsers } from '../hooks/useAdminUsers';
import AppShell from '../components/layout/AppShell';
import UserTable from '../components/admin/UserTable';
import InviteUserForm from '../components/admin/InviteUserForm';

export default function AdminDashboard() {
  const { user } = useAuth();
  const { users, loading, error, fetchUsers, addRole, removeRole } = useAdminUsers();
  const [showInvite, setShowInvite] = useState(false);
  const [actionError, setActionError] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleToggleRole(userId, role, hasRole) {
    setActionError(null);
    const result = hasRole
      ? await removeRole(userId, role)
      : await addRole(userId, role);
    if (result.error) {
      setActionError(result.error);
    }
  }

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
          <button
            onClick={() => setShowInvite(!showInvite)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg
              hover:bg-blue-700 transition"
          >
            {showInvite ? 'Cancel' : 'Invite User'}
          </button>
        </div>

        {actionError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {actionError}
            <button onClick={() => setActionError(null)} className="ml-2 text-red-500">&times;</button>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}

        {showInvite && (
          <InviteUserForm
            onDone={() => { setShowInvite(false); fetchUsers(); }}
          />
        )}

        <UserTable
          users={users}
          loading={loading}
          currentUserId={user?.id}
          onToggleRole={handleToggleRole}
        />
      </div>
    </AppShell>
  );
}
