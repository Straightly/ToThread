import { createContext, useState, useEffect, useCallback } from 'react';
import insforge from '../insforge';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [roles, setRoles] = useState([]);
  const [activeRole, setActiveRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchRoles = useCallback(async (userId) => {
    const { data, error } = await insforge.database
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (error) {
      console.error('Failed to fetch roles:', error);
      return [];
    }
    return (data || []).map(r => r.role);
  }, []);

  const ensureProfile = useCallback(async (u) => {
    const { data } = await insforge.database
      .from('profiles')
      .select('id')
      .eq('id', u.id);
    if (data && data.length > 0) return; // profile already exists

    const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email;
    await insforge.database.from('profiles').insert([{
      id: u.id,
      email: u.email,
      name,
    }]);
  }, []);

  const setupUser = useCallback(async (u) => {
    await ensureProfile(u);
    let userRoles = await fetchRoles(u.id);

    // Only assign 'user' role if the user has zero roles
    if (userRoles.length === 0) {
      const { error: insertErr } = await insforge.database.from('user_roles').insert([{
        user_id: u.id,
        role: 'user',
      }]);
      if (insertErr) {
        console.error('Failed to assign default role:', insertErr);
      }
      userRoles = await fetchRoles(u.id);
    }

    setUser(u);
    setRoles(userRoles);
    if (userRoles.length === 1) {
      setActiveRole(userRoles[0]);
    }
  }, [ensureProfile, fetchRoles]);

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await insforge.auth.getCurrentUser();
      if (error || !data?.user) {
        setUser(null);
        setRoles([]);
        setActiveRole(null);
        return;
      }
      await setupUser(data.user);
    } catch (err) {
      console.error('Session load error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setupUser]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signInWithGoogle = useCallback(async () => {
    await insforge.auth.signInWithOAuth({
      provider: 'google',
      redirectTo: window.location.origin,
    });
  }, []);

  const signOut = useCallback(async () => {
    await insforge.auth.signOut();
    setUser(null);
    setRoles([]);
    setActiveRole(null);
  }, []);

  const selectRole = useCallback((role) => {
    setActiveRole(role);
  }, []);

  const value = {
    user,
    roles,
    activeRole,
    loading,
    signInWithGoogle,
    signOut,
    selectRole,
    refreshRoles: () => user ? fetchRoles(user.id).then(setRoles) : Promise.resolve(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
