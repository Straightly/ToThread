import html from "./ui/index.html";
import { isStaticRequest } from './lib/utils.js';
import * as routes from './lib/routes.js';

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
      return routes.handleHealth();
    }

    if (url.pathname === "/debug/todos") {
      return routes.handleDebugTodos(env);
    }

    if (url.pathname === "/debug/allowlist") {
      return routes.handleDebugAllowlist(env);
    }

    if (url.pathname === "/debug/git") {
      return routes.handleDebugGit(request, env);
    }

    if (request.method === "GET" && url.pathname === "/todos") {
      return routes.handleGetTodos(request, env);
    }

    if (request.method === "POST" && url.pathname === "/writings") {
      return routes.handlePostWriting(request, env);
    }

    if (request.method === "PUT" && url.pathname === "/todos") {
      return routes.handlePutTodos(request, env);
    }

    if (request.method === "GET" && url.pathname === "/plan") {
      return routes.handleGetPlan(request, env);
    }

    if (request.method === "POST" && url.pathname === "/plan/tasks") {
      return routes.handleCreatePlanTask(request, env);
    }

    if (request.method === "PUT" && url.pathname.startsWith("/plan/tasks/")) {
      const taskId = url.pathname.replace("/plan/tasks/", "");
      if (!taskId) return new Response("Bad Request", { status: 400 });
      return routes.handleUpdatePlanTask(request, env, taskId);
    }

    if (request.method === "GET" && url.pathname.startsWith("/plan/tasks/")) {
      const taskId = url.pathname.replace("/plan/tasks/", "");
      if (!taskId) return new Response("Bad Request", { status: 400 });
      return routes.handleGetPlanTask(request, env, taskId);
    }

    if (request.method === "DELETE" && url.pathname.startsWith("/plan/tasks/")) {
      const taskId = url.pathname.replace("/plan/tasks/", "");
      if (!taskId) return new Response("Bad Request", { status: 400 });
      return routes.handleDeletePlanTask(request, env, taskId);
    }

    if (request.method === "GET" && url.pathname === "/threads") {
      return routes.handleGetThreads(request, env);
    }

    if (request.method === "GET" && url.pathname.startsWith("/threads/") && url.pathname !== "/threads/") {
      const tag = url.pathname.replace("/threads/", "");
      return routes.handleGetThread(request, env, tag);
    }

    if (request.method === "POST" && url.pathname.startsWith("/threads/")) {
      const tag = url.pathname.replace("/threads/", "");
      return routes.handlePostThread(request, env, tag);
    }

    if (url.pathname === "/kv-test") {
      return routes.handleKvTest(env);
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
