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
    if (!data || data.length === 0) {
      const name = u.user_metadata?.full_name || u.user_metadata?.name || u.email;
      await insforge.database.from('profiles').insert([{
        id: u.id,
        email: u.email,
        name,
      }]);
    }
  }, []);

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
      const u = data.user;
      await ensureProfile(u);
      setUser(u);
      const userRoles = await fetchRoles(u.id);
      setRoles(userRoles);
      if (userRoles.length === 1) {
        setActiveRole(userRoles[0]);
      }
    } catch (err) {
      console.error('Session load error:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [fetchRoles, ensureProfile]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signIn = useCallback(async (email, password) => {
    const { data, error } = await insforge.auth.signInWithPassword({ email, password });
    if (error) return { error };
    setUser(data.user);
    const userRoles = await fetchRoles(data.user.id);
    setRoles(userRoles);
    if (userRoles.length === 1) {
      setActiveRole(userRoles[0]);
    }
    return { data };
  }, [fetchRoles]);

  const signUp = useCallback(async (email, password, name) => {
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: window.location.origin + '/login',
    });
    if (error) return { error };

    if (data?.requireEmailVerification) {
      return { data, needsVerification: true };
    }

    if (data?.user) {
      // Insert profile row
      await insforge.database.from('profiles').insert([{
        id: data.user.id,
        email: data.user.email,
        name: name || data.user.email,
      }]);
      setUser(data.user);
      const userRoles = await fetchRoles(data.user.id);
      setRoles(userRoles);
      if (userRoles.length === 1) {
        setActiveRole(userRoles[0]);
      }
    }
    return { data };
  }, [fetchRoles]);

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
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    selectRole,
    refreshRoles: () => user ? fetchRoles(user.id).then(setRoles) : Promise.resolve(),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
