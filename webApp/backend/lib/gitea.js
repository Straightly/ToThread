// Gitea API interaction utilities

export function getGitToken(env) {
  return env.GIT_TOKEN_ATTENTION || null;
}

export function base64EncodeUtf8(text) {
  return btoa(unescape(encodeURIComponent(text)));
}

export function ensureTrailingSlash(url) {
  return url.endsWith("/") ? url : url + "/";
}

export function buildGiteaContentsUrl(env, filePath) {
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

export async function giteaRequest(env, url, method, bodyObj) {
  const token = getGitToken(env);
  if (!token) {
    throw new Error("Missing GIT_TOKEN_ATTENTION secret");
  }

  const headers = {
    "content-type": "application/json; charset=utf-8",
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

export function generateWritingFileName(content) {
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

export function isoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function generateWritingMarkdown(content) {
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
