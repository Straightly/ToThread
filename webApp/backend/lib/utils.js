// General utility functions

export function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function isStaticRequest(url) {
  return url.pathname.startsWith("/ui/");
}
