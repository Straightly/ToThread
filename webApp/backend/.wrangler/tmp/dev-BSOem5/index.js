var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.js
var TODOS_KEY = "todos/main";
var ALLOWLIST_KEY = "tothread/auth/allowlist";
function parseAuthorizationHeader(request) {
  const auth = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (scheme !== "Bearer" && scheme !== "bearer") return null;
  return token || null;
}
__name(parseAuthorizationHeader, "parseAuthorizationHeader");
function decodeJwtWithoutVerify(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const decoded = atob(payload);
  return JSON.parse(decoded);
}
__name(decodeJwtWithoutVerify, "decodeJwtWithoutVerify");
async function verifyGoogleIdToken(token, env) {
  if (!token) {
    throw new Error("Missing ID token");
  }
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }
  const claims = decodeJwtWithoutVerify(token);
  const now = Math.floor(Date.now() / 1e3);
  if (typeof claims.exp === "number" && claims.exp < now) {
    throw new Error("ID token has expired");
  }
  const iss = claims.iss;
  if (iss !== "https://accounts.google.com" && iss !== "accounts.google.com") {
    throw new Error("Unexpected token issuer");
  }
  const aud = claims.aud;
  const expected = env.GOOGLE_CLIENT_ID;
  const audMatch = Array.isArray(aud) ? aud.includes(expected) : aud === expected;
  if (!audMatch) {
    throw new Error("ID token audience does not match GOOGLE_CLIENT_ID");
  }
  const email = claims.email;
  if (!email) {
    throw new Error("ID token does not contain an email claim");
  }
  return { email, claims };
}
__name(verifyGoogleIdToken, "verifyGoogleIdToken");
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}
__name(jsonResponse, "jsonResponse");
async function getTodos(env) {
  const raw = await env.TOTHREAD_KV.get(TODOS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    throw new Error("Invalid JSON stored in todos/main");
  }
}
__name(getTodos, "getTodos");
async function saveTodos(env, todos) {
  await env.TOTHREAD_KV.put(TODOS_KEY, JSON.stringify(todos));
}
__name(saveTodos, "saveTodos");
async function getAllowlist(env) {
  const raw = await env.TOTHREAD_KV.get(ALLOWLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}
__name(getAllowlist, "getAllowlist");
async function isAllowed(env, email) {
  const allowlist = await getAllowlist(env);
  return allowlist.includes(email);
}
__name(isAllowed, "isAllowed");
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "ToThread-webApp" }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8"
          }
        }
      );
    }
    if (url.pathname === "/debug/todos") {
      try {
        const todos = await getTodos(env);
        return new Response(JSON.stringify({ status: "ok", todos }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" }
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ status: "error", message: String(err) }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" }
          }
        );
      }
    }
    if (url.pathname === "/debug/allowlist") {
      const allowlist = await getAllowlist(env);
      return new Response(JSON.stringify({ status: "ok", allowlist }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }
    if (request.method === "GET" && url.pathname === "/todos") {
      try {
        const token = parseAuthorizationHeader(request);
        const { email } = await verifyGoogleIdToken(token, env);
        const allowed = await isAllowed(env, email);
        if (!allowed) {
          return jsonResponse(
            { error: "forbidden", message: "User is not in allowlist" },
            403
          );
        }
        const todos = await getTodos(env);
        return jsonResponse({ status: "ok", email, todos }, 200);
      } catch (err) {
        return jsonResponse(
          { error: "unauthorized", message: String(err) },
          401
        );
      }
    }
    if (request.method === "PUT" && url.pathname === "/todos") {
      try {
        const token = parseAuthorizationHeader(request);
        const { email } = await verifyGoogleIdToken(token, env);
        const allowed = await isAllowed(env, email);
        if (!allowed) {
          return jsonResponse(
            { error: "forbidden", message: "User is not in allowlist" },
            403
          );
        }
        const text = await request.text();
        let todos;
        try {
          todos = JSON.parse(text);
        } catch {
          return jsonResponse(
            { error: "bad_request", message: "Body must be valid JSON" },
            400
          );
        }
        if (!Array.isArray(todos)) {
          return jsonResponse(
            { error: "bad_request", message: "Expected an array of todos" },
            400
          );
        }
        await saveTodos(env, todos);
        return jsonResponse({ status: "ok", email, count: todos.length }, 200);
      } catch (err) {
        return jsonResponse(
          { error: "unauthorized", message: String(err) },
          401
        );
      }
    }
    if (url.pathname === "/kv-test") {
      const key = "tothread:kv-test";
      const existing = await env.TOTHREAD_KV.get(key);
      const valueToStore = existing || (/* @__PURE__ */ new Date()).toISOString();
      await env.TOTHREAD_KV.put(key, valueToStore);
      return new Response(
        JSON.stringify({
          status: "ok",
          key,
          value: valueToStore,
          previous: existing
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8"
          }
        }
      );
    }
    const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>ToThread UI</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script src="https://accounts.google.com/gsi/client" async defer><\/script>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        margin: 0;
        padding: 2rem;
        background: #f8f9fa;
        color: #212529;
      }
      .container {
        max-width: 720px;
        margin: 0 auto;
      }
      h1 {
        margin-bottom: 0.5rem;
      }
      p {
        margin-top: 0.25rem;
        line-height: 1.5;
      }
      button {
        padding: 0.5rem 1rem;
        border-radius: 4px;
        border: 1px solid #ced4da;
        background: #ffffff;
        cursor: pointer;
      }
      button:disabled {
        opacity: 0.6;
        cursor: default;
      }
      pre {
        background: #212529;
        color: #f8f9fa;
        padding: 1rem;
        border-radius: 4px;
        overflow: auto;
        font-size: 0.9rem;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>ToThread Web Client</h1>
      <p>
        Sign in with Google, then fetch your todos from the protected
        <code>/todos</code> endpoint.
      </p>

      <div id="auth-section">
        <div id="g_id_signin"></div>
        <p id="auth-status">Not signed in.</p>
      </div>

      <div style="margin-top: 1rem">
        <button id="fetch-todos" disabled>Fetch /todos</button>
      </div>

      <h2 style="margin-top: 2rem">Response</h2>
      <pre id="output">(no response yet)</pre>
    </div>

    <script>
      const CLIENT_ID =
        "130905058858-07408ql1m1nonfoaftc415t0er256n5v.apps.googleusercontent.com";

      let idToken = null;

      function setStatus(text) {
        document.getElementById("auth-status").textContent = text;
      }

      function setOutput(obj) {
        const el = document.getElementById("output");
        el.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
      }

      window.handleCredentialResponse = (response) => {
        idToken = response.credential;
        setStatus("Signed in. ID token acquired.");
        document.getElementById("fetch-todos").disabled = false;
      };

      window.onload = () => {
        if (!window.google || !window.google.accounts || !window.google.accounts.id) {
          setStatus("Google Identity Services not loaded.");
          return;
        }

        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: window.handleCredentialResponse,
        });

        google.accounts.id.renderButton(document.getElementById("g_id_signin"), {
          theme: "outline",
          size: "large",
        });

        google.accounts.id.prompt();

        document.getElementById("fetch-todos").addEventListener("click", async () => {
          if (!idToken) {
            setStatus("No ID token. Please sign in first.");
            return;
          }
          try {
            const res = await fetch("/todos", {
              method: "GET",
              headers: {
                Authorization: "Bearer " + idToken,
              },
            });
            const data = await res.json();
            setOutput(data);
          } catch (err) {
            setOutput({ error: String(err) });
          }
        });
      };
    <\/script>
  </body>
</html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8"
      }
    });
  }
};

// ../../../../../Users/zhian/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../../../../Users/zhian/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-R81OiW/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = index_default;

// ../../../../../Users/zhian/AppData/Roaming/npm/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-R81OiW/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
