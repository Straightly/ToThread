import { useState } from 'react';

export default function LoginForm({ isSignUp, onSubmit, submitting }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    onSubmit(email, password, name);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {isSignUp && (
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        required
        minLength={6}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
      <button
        type="submit"
        disabled={submitting}
        className="w-full py-2 text-sm font-medium text-white bg-blue-600 rounded-md
          hover:bg-blue-700 disabled:opacity-50 transition"
      >
        {submitting ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
      </button>
    </form>
  );
}
