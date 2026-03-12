import { getRepoFile, createOrUpdateRepoFile } from "./gitea.js";

const DEFAULT_PLAN_PATH = "ProjectPlan.yaml";

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "") return "";
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (!Number.isNaN(Number(trimmed)) && /^-?\d+(\.\d+)?$/.test(trimmed)) {
    return Number(trimmed);
  }
  return trimmed;
}

function parseInlineArray(value) {
  const inner = value.trim().slice(1, -1);
  if (!inner.trim()) return [];
  return inner.split(",").map((part) => parseScalar(part));
}

function nextNonEmptyLine(lines, startIndex) {
  for (let i = startIndex; i < lines.length; i += 1) {
    const line = lines[i];
    if (line && line.trim() && !line.trim().startsWith("#")) return line;
  }
  return null;
}

function parseYaml(text) {
  const lines = text.split(/\r?\n/);
  const root = {};
  const stack = [{ indent: -1, container: root, type: "object" }];

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw) continue;
    if (raw.trim().startsWith("#")) continue;
    if (!raw.trim()) continue;

    const indent = raw.match(/^ */)[0].length;
    const line = raw.trim();

    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const ctx = stack[stack.length - 1];

    if (line.startsWith("- ")) {
      if (ctx.type !== "array") {
        ctx.container = [];
        ctx.type = "array";
        if (stack.length > 1) {
          const parent = stack[stack.length - 2];
          const key = parent.pendingKey;
          if (key) {
            parent.container[key] = ctx.container;
            delete parent.pendingKey;
          }
        }
      }
      const itemText = line.slice(2);
      if (itemText.includes(":")) {
        const [k, ...rest] = itemText.split(":");
        const key = k.trim();
        const value = rest.join(":").trim();
        const obj = {};
        if (value) {
          obj[key] = value.startsWith("[") && value.endsWith("]")
            ? parseInlineArray(value)
            : parseScalar(value);
        } else {
          obj[key] = {};
          obj.pendingKey = key;
        }
        ctx.container.push(obj);
        // Always allow following indented lines to extend this object.
        stack.push({ indent, container: obj, type: "object" });
      } else {
        ctx.container.push(parseScalar(itemText));
      }
      continue;
    }

    const [k, ...rest] = line.split(":");
    const key = k.trim();
    const value = rest.join(":").trim();
    if (value) {
      ctx.container[key] = value.startsWith("[") && value.endsWith("]")
        ? parseInlineArray(value)
        : parseScalar(value);
    } else {
      const lookahead = nextNonEmptyLine(lines, i + 1);
      const willBeArray = lookahead ? lookahead.trim().startsWith("- ") : false;
      ctx.container[key] = willBeArray ? [] : {};
      ctx.pendingKey = key;
      stack.push({ indent, container: ctx.container[key], type: willBeArray ? "array" : "object" });
    }
  }

  return root;
}

function formatScalar(value) {
  if (typeof value === "string") {
    if (value === "" || /[:#\-\[\]\n]/.test(value)) {
      return JSON.stringify(value);
    }
    return value;
  }
  if (typeof value === "boolean" || typeof value === "number") return String(value);
  if (value === null || value === undefined) return "null";
  return JSON.stringify(value);
}

function stringifyYaml(obj, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(obj)) {
    return obj
      .map((item) => {
        if (typeof item === "object" && item !== null) {
          const inner = stringifyYaml(item, indent + 2);
          return `${pad}- ${inner.trimStart()}`;
        }
        return `${pad}- ${formatScalar(item)}`;
      })
      .join("\n");
  }

  if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj)
      .filter(([key]) => key !== "pendingKey")
      .map(([key, value]) => {
        if (Array.isArray(value)) {
          if (!value.length) return `${pad}${key}: []`;
          const inner = stringifyYaml(value, indent + 2);
          return `${pad}${key}:\n${inner}`;
        }
        if (typeof value === "object" && value !== null) {
          const inner = stringifyYaml(value, indent + 2);
          return `${pad}${key}:\n${inner}`;
        }
        return `${pad}${key}: ${formatScalar(value)}`;
      })
      .join("\n");
  }

  return `${pad}${formatScalar(obj)}`;
}

function planPath(env) {
  return env.PLAN_FILE_PATH || DEFAULT_PLAN_PATH;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function getRootTasks(plan) {
  if (Array.isArray(plan.sections)) return plan.sections;
  if (Array.isArray(plan.tasks)) return plan.tasks;
  plan.tasks = [];
  return plan.tasks;
}

function walkTasks(tasks, visitor, parent = null, parentList = null) {
  for (let i = 0; i < tasks.length; i += 1) {
    const task = tasks[i];
    const stop = visitor(task, parent, parentList || tasks, i);
    if (stop) return stop;
    const children = ensureArray(task.tasks);
    const found = walkTasks(children, visitor, task, children);
    if (found) return found;
  }
  return null;
}

function findTaskById(plan, id) {
  const root = getRootTasks(plan);
  return walkTasks(root, (task, parent, list, index) => {
    if (task && task.id === id) {
      return { task, parent, list, index };
    }
    return null;
  });
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "task";
}

function generateTaskId(title) {
  return `${slugify(title)}-${Date.now()}`;
}

export async function loadPlan(env) {
  const branch = env.GIT_BRANCH || "main";
  const filePath = planPath(env);
  const file = await getRepoFile(env, filePath, branch);
  if (!file.exists) {
    return { exists: false, filePath, branch };
  }
  const raw = file.content || "";
  const plan = parseYaml(raw);
  return { exists: true, filePath, branch, raw, plan };
}

export async function savePlan(env, plan, message) {
  const branch = env.GIT_BRANCH || "main";
  const filePath = planPath(env);
  const content = stringifyYaml(plan);
  const result = await createOrUpdateRepoFile(env, filePath, content, message, branch);
  const commit = result.result && result.result.commit ? result.result.commit : null;
  return {
    action: result.action,
    filePath,
    branch,
    commit: commit
      ? {
          sha: commit.id || commit.sha || null,
          message: commit.message || null,
        }
      : null,
  };
}

export function addTask(plan, parentId, taskInput, position) {
  const task = { ...taskInput };
  if (!task.id) task.id = generateTaskId(task.title);
  if (!task.status) task.status = "Pending";
  if (!Array.isArray(task.tasks)) delete task.tasks;

  if (parentId) {
    const found = findTaskById(plan, parentId);
    if (!found) return { error: "Parent task not found" };
    found.task.tasks = ensureArray(found.task.tasks);
    const list = found.task.tasks;
    const index = Number.isInteger(position) ? Math.max(0, Math.min(position, list.length)) : list.length;
    list.splice(index, 0, task);
    return { task };
  }

  const root = getRootTasks(plan);
  const index = Number.isInteger(position) ? Math.max(0, Math.min(position, root.length)) : root.length;
  root.splice(index, 0, task);
  return { task };
}

export function replaceTask(plan, id, taskInput) {
  const found = findTaskById(plan, id);
  if (!found) return { error: "Task not found" };
  const task = { ...taskInput, id };
  found.list[found.index] = task;
  return { task };
}

export function deleteTask(plan, id) {
  const found = findTaskById(plan, id);
  if (!found) return { error: "Task not found" };
  const removed = found.list.splice(found.index, 1)[0];
  return { ok: true, task: removed };
}

export function getTask(plan, id) {
  const found = findTaskById(plan, id);
  if (!found) return { error: "Task not found" };
  return { task: found.task };
}
