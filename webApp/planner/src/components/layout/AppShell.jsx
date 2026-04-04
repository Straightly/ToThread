import { useAuth } from '../../hooks/useAuth';
import { useNavigate, useLocation } from 'react-router-dom';
import { ROLE_NAMES } from '../../lib/constants';

export default function AppShell({ children }) {
  const { user, activeRole, signOut, selectRole, roles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  function handleSwitchRole() {
    selectRole(null);
    navigate('/select-role');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">Planner</span>
            {activeRole && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                activeRole === 'admin'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {ROLE_NAMES[activeRole] || activeRole}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {activeRole === 'admin' && (
              <button
                onClick={() => navigate('/')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Tasks
              </button>
            )}
            {activeRole === 'user' && (
              <>
                <button
                  onClick={() => navigate('/')}
                  className={`text-sm ${location.pathname === '/' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  To Do
                </button>
                <button
                  onClick={() => navigate('/planner')}
                  className={`text-sm ${location.pathname === '/planner' ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  Planner
                </button>
                {roles.includes('admin') && (
                  <button
                    onClick={() => { selectRole('admin'); navigate('/admin'); }}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    Admin
                  </button>
                )}
              </>
            )}
            {activeRole === 'admin' && (
              <button
                onClick={() => navigate('/admin')}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Users
              </button>
            )}
            {roles.length > 1 && (
              <button
                onClick={handleSwitchRole}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Switch Role
              </button>
            )}
            <span className="text-xs text-gray-400 hidden sm:inline">{user?.email}</span>
            <button
              onClick={signOut}
              className="text-sm text-gray-500 hover:text-red-600 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
