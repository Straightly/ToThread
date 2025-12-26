// Route handlers

import { parseAuthorizationHeader, verifyGoogleIdToken, isAllowed, getAllowlist, isAuthError } from './auth.js';
import { getTodos, saveTodos } from './todos.js';
import { listThreads, getThreadContent, appendThreadEntry } from './threads.js';
import { giteaRequest, buildGiteaContentsUrl, ensureTrailingSlash, generateWritingFileName, generateWritingMarkdown, base64EncodeUtf8 } from './gitea.js';
import { jsonResponse } from './utils.js';

export async function handleHealth() {
  return jsonResponse({ status: "ok", service: "ToThread-webApp" }, 200);
}

export async function handleDebugTodos(env) {
  try {
    const todos = await getTodos(env);
    return jsonResponse({ status: "ok", todos }, 200);
  } catch (err) {
    return jsonResponse({ status: "error", message: String(err) }, 500);
  }
}

export async function handleDebugAllowlist(env) {
  const allowlist = await getAllowlist(env);
  return jsonResponse({ status: "ok", allowlist }, 200);
}

export async function handleDebugGit(request, env) {
  try {
    const token = parseAuthorizationHeader(request);
    const { email } = await verifyGoogleIdToken(token, env);
    const allowed = await isAllowed(env, email);
    if (!allowed) {
      return jsonResponse({ error: "forbidden", message: "User is not in allowlist" }, 403);
    }

    const base = ensureTrailingSlash(env.GIT_BASE_URL);
    const owner = env.GIT_OWNER;
    const repo = env.GIT_REPO;
    const repoUrl = `${base}api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
    
    const result = await giteaRequest(env, repoUrl, "GET");
    
    return jsonResponse(
      { 
        status: "ok", 
        email, 
        repo: result.full_name, 
        private: result.private,
        description: result.description
      }, 
      200
    );
  } catch (err) {
    return jsonResponse({ status: "error", message: String(err) }, 500);
  }
}

export async function handleGetTodos(request, env) {
  try {
    const token = parseAuthorizationHeader(request);
    const { email } = await verifyGoogleIdToken(token, env);

    const allowed = await isAllowed(env, email);
    if (!allowed) {
      return jsonResponse({ error: "forbidden", message: "User is not in allowlist" }, 403);
    }

    const todos = await getTodos(env);
    return jsonResponse({ status: "ok", email, todos }, 200);
  } catch (err) {
    return jsonResponse({ error: "unauthorized", message: String(err) }, 401);
  }
}

export async function handlePutTodos(request, env) {
  try {
    const token = parseAuthorizationHeader(request);
    const { email } = await verifyGoogleIdToken(token, env);

    const allowed = await isAllowed(env, email);
    if (!allowed) {
      return jsonResponse({ error: "forbidden", message: "User is not in allowlist" }, 403);
    }

    const text = await request.text();
    let todos;
    try {
      todos = JSON.parse(text);
    } catch {
      return jsonResponse({ error: "bad_request", message: "Body must be valid JSON" }, 400);
    }

    if (!Array.isArray(todos)) {
      return jsonResponse({ error: "bad_request", message: "Expected an array of todos" }, 400);
    }

    await saveTodos(env, todos);
    return jsonResponse({ status: "ok", email, count: todos.length }, 200);
  } catch (err) {
    return jsonResponse({ error: "unauthorized", message: String(err) }, 401);
  }
}

export async function handlePostWriting(request, env) {
  try {
    const token = parseAuthorizationHeader(request);
    const { email } = await verifyGoogleIdToken(token, env);

    const allowed = await isAllowed(env, email);
    if (!allowed) {
      return jsonResponse({ error: "forbidden", message: "User is not in allowlist" }, 403);
    }

    const body = await request.json().catch(() => null);
    const content = body && typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return jsonResponse({ error: "bad_request", message: "Body must include non-empty 'content'" }, 400);
    }

    const fileName = generateWritingFileName(content);
    const repoPath = `Writing/RawWrittings/${fileName}`;
    const markdown = generateWritingMarkdown(content);
    const encodedContent = base64EncodeUtf8(markdown);

    const branch = env.GIT_BRANCH || "main";
    const urlToCall = buildGiteaContentsUrl(env, repoPath);
    const result = await giteaRequest(env, urlToCall, "POST", {
      content: encodedContent,
      message: `Add raw writing via ToThread - ${new Date().toISOString()}`,
      branch,
    });

    return jsonResponse(
      {
        status: "ok",
        email,
        path: repoPath,
        fileName,
        gitea: result,
      },
      200
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return jsonResponse(
      { error: isAuthError(msg) ? "unauthorized" : "server_error", message: msg },
      isAuthError(msg) ? 401 : 500
    );
  }
}

export async function handleGetThreads(request, env) {
  try {
    const token = parseAuthorizationHeader(request);
    const { email } = await verifyGoogleIdToken(token, env);

    const allowed = await isAllowed(env, email);
    if (!allowed) {
      return jsonResponse({ error: "forbidden", message: "User is not in allowlist" }, 403);
    }

    const threads = await listThreads(env);
    return jsonResponse({ status: "ok", threads }, 200);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return jsonResponse(
      { error: isAuthError(msg) ? "unauthorized" : "server_error", message: msg },
      isAuthError(msg) ? 401 : 500
    );
  }
}

export async function handleGetThread(request, env, tag) {
  try {
    const token = parseAuthorizationHeader(request);
    const { email } = await verifyGoogleIdToken(token, env);

    const allowed = await isAllowed(env, email);
    if (!allowed) {
      return jsonResponse({ error: "forbidden", message: "User is not in allowlist" }, 403);
    }

    if (!tag || tag.includes("/") || tag.includes("\\")) {
      return jsonResponse({ error: "bad_request", message: "Invalid thread tag" }, 400);
    }

    const { fullContent, lines, totalLines } = await getThreadContent(env, tag);

    return jsonResponse(
      {
        status: "ok",
        tag,
        lines,
        fullContent,
        totalLines,
      },
      200
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return jsonResponse(
      { error: isAuthError(msg) ? "unauthorized" : "server_error", message: msg },
      isAuthError(msg) ? 401 : 500
    );
  }
}

export async function handlePostThread(request, env, tag) {
  try {
    const token = parseAuthorizationHeader(request);
    const { email } = await verifyGoogleIdToken(token, env);

    const allowed = await isAllowed(env, email);
    if (!allowed) {
      return jsonResponse({ error: "forbidden", message: "User is not in allowlist" }, 403);
    }

    if (!tag || tag.includes("/") || tag.includes("\\")) {
      return jsonResponse({ error: "bad_request", message: "Invalid thread tag" }, 400);
    }

    const body = await request.json().catch(() => null);
    const content = body && typeof body.content === "string" ? body.content : "";
    if (!content.trim()) {
      return jsonResponse({ error: "bad_request", message: "Body must include non-empty 'content'" }, 400);
    }

    const result = await appendThreadEntry(env, tag, content);

    return jsonResponse(
      {
        status: "ok",
        email,
        tag,
        ...result,
      },
      200
    );
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return jsonResponse(
      { error: isAuthError(msg) ? "unauthorized" : "server_error", message: msg },
      isAuthError(msg) ? 401 : 500
    );
  }
}

export async function handleKvTest(env) {
  const key = "tothread:kv-test";
  const existing = await env.TOTHREAD_KV.get(key);
  const valueToStore = existing || new Date().toISOString();
  await env.TOTHREAD_KV.put(key, valueToStore);

  return jsonResponse(
    {
      status: "ok",
      key,
      value: valueToStore,
      previous: existing,
    },
    200
  );
}
