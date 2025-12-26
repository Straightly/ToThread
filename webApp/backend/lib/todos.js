// Todo management utilities

const TODOS_KEY = "todos/main";

export async function getTodos(env) {
  const raw = await env.TOTHREAD_KV.get(TODOS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON stored in todos/main");
  }
}

export async function saveTodos(env, todos) {
  await env.TOTHREAD_KV.put(TODOS_KEY, JSON.stringify(todos));
}
