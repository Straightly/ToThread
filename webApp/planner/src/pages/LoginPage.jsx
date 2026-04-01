import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import LoginForm from '../components/auth/LoginForm';
import OAuthButton from '../components/auth/OAuthButton';

export default function LoginPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(email, password, name) {
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      if (isSignUp) {
        const result = await signUp(email, password, name);
        if (result.error) {
          setError(result.error.message || 'Sign up failed');
        } else if (result.needsVerification) {
          setMessage('Check your email to verify your account, then sign in.');
          setIsSignUp(false);
        }
      } else {
        const result = await signIn(email, password);
        if (result.error) {
          setError(result.error.message || 'Sign in failed');
        }
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold text-center text-gray-900 mb-6">
          Project Planner
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md text-sm">
            {message}
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <LoginForm
            isSignUp={isSignUp}
            onSubmit={handleSubmit}
            submitting={submitting}
          />

          <div className="mt-4 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          <OAuthButton provider="google" onClick={signInWithGoogle} className="mt-4" />

          <p className="mt-4 text-center text-sm text-gray-500">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null); }}
              className="text-blue-600 hover:underline font-medium"
            >
              {isSignUp ? 'Sign in' : 'Sign up'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
