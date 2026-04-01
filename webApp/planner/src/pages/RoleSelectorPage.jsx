import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { ROLE_NAMES } from '../lib/constants';

export default function RoleSelectorPage() {
  const { roles, selectRole, user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSelect = (role) => {
    selectRole(role);
    navigate(role === 'admin' ? '/admin' : '/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center text-gray-900 mb-2">
          Select Role
        </h1>
        <p className="text-center text-sm text-gray-500 mb-6">
          Signed in as {user?.email}
        </p>

        <div className="space-y-3">
          {roles.map(role => (
            <button
              key={role}
              onClick={() => handleSelect(role)}
              className="w-full p-4 bg-white border border-gray-200 rounded-lg shadow-sm
                hover:border-blue-400 hover:bg-blue-50 transition text-left"
            >
              <div className="font-medium text-gray-900">{ROLE_NAMES[role] || role}</div>
              <div className="text-sm text-gray-500 mt-1">
                {role === 'admin' ? 'Manage users and roles' : 'View and manage your project plan'}
              </div>
            </button>
          ))}
        </div>

        <button
          onClick={signOut}
          className="mt-6 w-full text-sm text-gray-400 hover:text-gray-600"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
