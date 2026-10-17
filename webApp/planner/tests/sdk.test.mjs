import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@insforge/sdk';

test('SDK OAuth API sends the redirect and PKCE challenge without browser navigation', async () => {
  let requestUrl;
  const client = createClient({
    baseUrl: 'https://example.invalid',
    anonKey: 'test-only',
    auth: { detectSessionInUrl: false },
    fetch: async (input) => {
      requestUrl = new URL(typeof input === 'string' ? input : input.url);
      return Response.json({ authUrl: 'https://accounts.example.invalid/authorize' });
    },
  });
  const { data, error } = await client.auth.signInWithOAuth('google', {
    redirectTo: 'https://planner.example.invalid',
    skipBrowserRedirect: true,
  });
  assert.equal(error, null);
  assert.equal(data.url, 'https://accounts.example.invalid/authorize');
  assert.equal(requestUrl.pathname, '/api/auth/oauth/google');
  assert.equal(requestUrl.searchParams.get('redirect_uri'), 'https://planner.example.invalid');
  assert.ok(requestUrl.searchParams.get('code_challenge'));
});

test('SDK database query retains task filters and ordering', async () => {
  let requestUrl;
  const client = createClient({
    baseUrl: 'https://example.invalid',
    anonKey: 'test-only',
    auth: { detectSessionInUrl: false },
    fetch: async (input) => {
      requestUrl = new URL(typeof input === 'string' ? input : input.url);
      return Response.json([{ id: 'task-1', title: 'Example' }]);
    },
  });
  const { data, error } = await client.database.from('tasks').select('*')
    .eq('user_id', 'user-1').is('deleted_at', null).order('position', { ascending: true });
  assert.equal(error, null);
  assert.equal(data[0].id, 'task-1');
  assert.equal(requestUrl.searchParams.get('user_id'), 'eq.user-1');
  assert.equal(requestUrl.searchParams.get('deleted_at'), 'is.null');
  assert.equal(requestUrl.searchParams.get('order'), 'position.asc');
});
