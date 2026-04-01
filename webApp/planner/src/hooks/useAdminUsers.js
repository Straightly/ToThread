import { useState, useCallback } from 'react';
import insforge from '../insforge';
import { joinUsersWithRoles } from '../lib/taskTree';

export function useAdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        insforge.database.from('profiles').select('*'),
        insforge.database.from('user_roles').select('*'),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;
      setUsers(joinUsersWithRoles(profilesRes.data || [], rolesRes.data || []));
    } catch (err) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, []);

  const addRole = useCallback(async (userId, role) => {
    const { error } = await insforge.database
      .from('user_roles')
      .insert([{ user_id: userId, role }]);
    if (error) return { error: error.message };
    await fetchUsers();
    return { success: true };
  }, [fetchUsers]);

  const removeRole = useCallback(async (userId, role) => {
    const { error } = await insforge.database
      .from('user_roles')
      .delete()
      .eq('user_id', userId)
      .eq('role', role);
    if (error) return { error: error.message };
    await fetchUsers();
    return { success: true };
  }, [fetchUsers]);

  return { users, loading, error, fetchUsers, addRole, removeRole };
}
