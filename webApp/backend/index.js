import html from "./ui/index.html";
const TODOS_KEY = "todos/main";
const ALLOWLIST_KEY = "tothread/auth/allowlist";

function getGitToken(env) {
  return env.GIT_TOKEN_ATTENTION || null;
}

 function base64EncodeUtf8(text) {
   return btoa(unescape(encodeURIComponent(text)));
 }

 function ensureTrailingSlash(url) {
   return url.endsWith("/") ? url : url + "/";
 }

 function buildGiteaContentsUrl(env, filePath) {
   const base = env.GIT_BASE_URL;
   const owner = env.GIT_OWNER;
   const repo = env.GIT_REPO;
   if (!base || !owner || !repo) {
     throw new Error("Missing Gitea configuration (GIT_BASE_URL/GIT_OWNER/GIT_REPO)");
   }
   const normalizedBase = ensureTrailingSlash(base);
   const trimmed = String(filePath || "").replace(/^\/+/, "");
   return `${normalizedBase}api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${trimmed}`;
 }

 async function giteaRequest(env, url, method, bodyObj) {
   const token = getGitToken(env);
   if (!token) {
     throw new Error("Missing GIT_TOKEN_ATTENTION secret");
   }

   const headers = {
     "content-type": "application/json; charset=utf-8",
     // Gitea supports token auth in this form.
     Authorization: `token ${token}`,
     Accept: "application/json",
   };

   let res;
   try {
     res = await fetch(url, {
       method,
       headers,
       body: bodyObj ? JSON.stringify(bodyObj) : undefined,
     });
   } catch (e) {
     throw new Error(
       `Failed to reach Gitea (${env.GIT_BASE_URL}). If your Gitea uses a self-signed TLS cert, Cloudflare Workers will reject it. Underlying error: ${String(e)}`
     );
   }

   const text = await res.text();
   let data = null;
   try {
     data = text ? JSON.parse(text) : null;
   } catch {
     data = { raw: text };
   }

   if (!res.ok) {
     const msg =
       (data && (data.message || data.error)) ||
       (typeof data?.raw === "string" && data.raw.trim()) ||
       `HTTP ${res.status}`;
     throw new Error(`Gitea API error: ${msg}`);
   }

   return data;
 }

 function generateWritingFileName(content) {
   const words = String(content || "")
     .trim()
     .split(/\s+/)
     .filter((w) => w.length > 2)
     .slice(0, 5)
     .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
     .filter((w) => w.length > 0)
     .join("");
   const baseName = words.substring(0, 40) || "RawWriting";
   const timestamp = Date.now();
   return `${baseName}_${timestamp}.md`;
 }

 function isoDate() {
   const now = new Date();
   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, "0");
   const day = String(now.getDate()).padStart(2, "0");
   return `${year}-${month}-${day}`;
 }

 function generateWritingMarkdown(content) {
   const date = isoDate();
   const trimmed = String(content || "").trim();
   const title = trimmed.split(/[.!?]/)[0].trim().slice(0, 60) || "Raw writing";
   return `---\n` +
     `title: ${title}\n` +
     `date: ${date}\n` +
     `tags: #idea #raw-thought\n` +
     `context: Captured via ToThread\n` +
     `status: raw-idea\n` +
     `---\n\n` +
     `## Initial Spark\n\n` +
     `${trimmed}\n`;
 }

function isStaticRequest(url) {
  return url.pathname.startsWith("/ui/");
}

function parseAuthorizationHeader(request) {
  const auth = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!auth) return null;
  const parts = auth.split(" ");
  if (parts.length !== 2) return null;
  const [scheme, token] = parts;
  if (scheme !== "Bearer" && scheme !== "bearer") return null;
  return token || null;
}

function decodeJwtWithoutVerify(token) {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }
  const payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const decoded = atob(payload);
  return JSON.parse(decoded);
}

async function verifyGoogleIdToken(token, env) {
  if (!token) {
    throw new Error("Missing ID token");
  }
  if (!env.GOOGLE_CLIENT_ID) {
    throw new Error("GOOGLE_CLIENT_ID is not configured");
  }

  const claims = decodeJwtWithoutVerify(token);

  const now = Math.floor(Date.now() / 1000);
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

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function getTodos(env) {
  const raw = await env.TOTHREAD_KV.get(TODOS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch (e) {
    // If parsing fails, surface a clear error to the caller.
    throw new Error("Invalid JSON stored in todos/main");
  }
}

async function saveTodos(env, todos) {
  await env.TOTHREAD_KV.put(TODOS_KEY, JSON.stringify(todos));
}

async function getAllowlist(env) {
  const raw = await env.TOTHREAD_KV.get(ALLOWLIST_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    // If parsing fails, treat as empty; we will tighten this once auth is enforced.
    return [];
  }
}

async function isAllowed(env, email) {
  const allowlist = await getAllowlist(env);
  return allowlist.includes(email);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 6.1.5: delegate /ui/* requests to the ASSETS binding so they are served
    // directly from the ui folder instead of from inline strings.
    if (isStaticRequest(url) && env.ASSETS) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = assetUrl.pathname.replace(/^\/ui/, "");
      const assetRequest = new Request(assetUrl.toString(), request);
      return env.ASSETS.fetch(assetRequest);
    }

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "ToThread-webApp" }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
        }
      );
    }

    if (url.pathname === "/debug/todos") {
      try {
        const todos = await getTodos(env);
        return new Response(JSON.stringify({ status: "ok", todos }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ status: "error", message: String(err) }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=utf-8" },
          }
        );
      }
    }

    if (url.pathname === "/debug/allowlist") {
      const allowlist = await getAllowlist(env);
      return new Response(JSON.stringify({ status: "ok", allowlist }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (url.pathname === "/debug/git") {
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
        // Verify connectivity by fetching repo metadata
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

     if (request.method === "POST" && url.pathname === "/writings") {
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

         const body = await request.json().catch(() => null);
         const content = body && typeof body.content === "string" ? body.content : "";
         if (!content.trim()) {
           return jsonResponse(
             { error: "bad_request", message: "Body must include non-empty 'content'" },
             400
           );
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
         // Treat as unauthorized if token verification failed; otherwise surface as 500.
         const msg = err && err.message ? err.message : String(err);
         const isAuthError =
           msg.includes("Missing ID token") ||
           msg.includes("ID token") ||
           msg.includes("Unexpected token issuer") ||
           msg.includes("audience");
         return jsonResponse(
           { error: isAuthError ? "unauthorized" : "server_error", message: msg },
           isAuthError ? 401 : 500
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
      const valueToStore = existing || new Date().toISOString();
      await env.TOTHREAD_KV.put(key, valueToStore);

      return new Response(
        JSON.stringify({
          status: "ok",
          key,
          value: valueToStore,
          previous: existing,
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
        }
      );
    }
    // Serve the new UI for root
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(html, {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
