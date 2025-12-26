// Thread journal utilities

import { giteaRequest, buildGiteaContentsUrl, base64EncodeUtf8 } from './gitea.js';

export async function listThreads(env) {
  const threadsPath = "Writing/Threads";
  const urlToCall = buildGiteaContentsUrl(env, threadsPath);
  
  let files;
  try {
    files = await giteaRequest(env, urlToCall, "GET");
  } catch (err) {
    if (String(err).includes("404") || String(err).includes("not found")) {
      return [];
    }
    throw err;
  }

  if (!Array.isArray(files)) {
    return [];
  }

  return files
    .filter(f => f.type === "file" && f.name && f.name.endsWith(".md"))
    .map(f => f.name.replace(/\.md$/, ""))
    .sort();
}

export async function getThreadContent(env, tag) {
  const repoPath = `Writing/Threads/${tag}.md`;
  const urlToCall = buildGiteaContentsUrl(env, repoPath);

  let fullContent = "";
  try {
    const fileData = await giteaRequest(env, urlToCall, "GET");
    if (fileData && fileData.content) {
      fullContent = atob(fileData.content);
    }
  } catch (err) {
    if (String(err).includes("404") || String(err).includes("not found")) {
      return { fullContent: "", lines: [], totalLines: 0 };
    }
    throw err;
  }

  const allLines = fullContent.split("\n");
  const last30Lines = allLines.slice(-30);

  return {
    fullContent,
    lines: last30Lines,
    totalLines: allLines.length,
  };
}

export async function appendThreadEntry(env, tag, content) {
  const repoPath = `Writing/Threads/${tag}.md`;
  const urlToCall = buildGiteaContentsUrl(env, repoPath);
  const branch = env.GIT_BRANCH || "main";

  let existingContent = "";
  let sha = null;
  try {
    const fileData = await giteaRequest(env, urlToCall, "GET");
    if (fileData && fileData.content) {
      existingContent = atob(fileData.content);
    }
    sha = fileData?.sha || null;
  } catch (err) {
    if (!String(err).includes("404") && !String(err).includes("not found")) {
      throw err;
    }
  }

  const timestamp = new Date().toISOString();
  const newEntry = `\n## ${timestamp}\n\n${content.trim()}\n`;
  const updatedContent = existingContent + newEntry;
  const encodedContent = base64EncodeUtf8(updatedContent);

  const payload = {
    content: encodedContent,
    message: `Add entry to ${tag} thread - ${timestamp}`,
    branch,
  };
  if (sha) {
    payload.sha = sha;
  }

  const result = await giteaRequest(env, urlToCall, sha ? "PUT" : "POST", payload);

  return {
    path: repoPath,
    timestamp,
    gitea: result,
  };
}
