import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { useAuth } from './hooks/useAuth';
import { isAdmin } from './lib/taskTree';
import LoginPage from './pages/LoginPage';
import RoleSelectorPage from './pages/RoleSelectorPage';
import PlannerPage from './pages/PlannerPage';
import AdminDashboard from './pages/AdminDashboard';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleGate({ children }) {
  const { user, roles, activeRole, loading } = useAuth();
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (roles.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Pending</h2>
          <p className="text-sm text-gray-500">Your account has no roles assigned yet. Please contact an administrator.</p>
        </div>
      </div>
    );
  }
  if (roles.length > 1 && !activeRole) {
    return <Navigate to="/select-role" replace />;
  }
  return children;
}

function AdminRoute({ children }) {
  const { activeRole, roles } = useAuth();
  const role = activeRole || (roles.length === 1 ? roles[0] : null);
  if (!isAdmin([role])) return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/select-role" element={
        <ProtectedRoute><RoleSelectorPage /></ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute><RoleGate><PlannerPage /></RoleGate></ProtectedRoute>
      } />
      <Route path="/admin" element={
        <ProtectedRoute><RoleGate><AdminRoute><AdminDashboard /></AdminRoute></RoleGate></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
