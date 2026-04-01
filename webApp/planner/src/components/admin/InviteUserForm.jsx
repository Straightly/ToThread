import { useState } from 'react';
import insforge from '../../insforge';

export default function InviteUserForm({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [assignAdmin, setAssignAdmin] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Sign up the new user
      const { data, error: signUpError } = await insforge.auth.signUp({
        email,
        password,
        name,
      });

      if (signUpError) {
        setError(signUpError.message || 'Failed to create user');
        setSubmitting(false);
        return;
      }

      // If we got a user back, create profile and assign roles
      if (data?.user) {
        await insforge.database.from('profiles').insert([{
          id: data.user.id,
          email,
          name: name || email,
        }]);

        // Always assign 'user' role
        await insforge.database.from('user_roles').insert([{
          user_id: data.user.id,
          role: 'user',
        }]);

        if (assignAdmin) {
          await insforge.database.from('user_roles').insert([{
            user_id: data.user.id,
            role: 'admin',
          }]);
        }
      }

      setEmail('');
      setPassword('');
      setName('');
      setAssignAdmin(false);
      onDone();
    } catch (err) {
      setError(err.message || 'Failed to invite user');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Invite New User</h3>

      {error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          placeholder="Temporary password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <input
            type="checkbox"
            checked={assignAdmin}
            onChange={e => setAssignAdmin(e.target.checked)}
            className="rounded border-gray-300"
          />
          Also assign admin role
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-md
            hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {submitting ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  );
}
