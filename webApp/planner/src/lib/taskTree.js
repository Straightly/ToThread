export function isAdmin(roles) {
  return Array.isArray(roles) && roles.includes('admin');
}

export function isDoneStatus(status) {
  return status === 'Done' || status === 'Completed';
}

export function isDone(task) {
  return isDoneStatus(task.status);
}

export function isContinuous(task) {
  return task.status === 'Continuous';
}

export function countChildren(children) {
  const total = children.length;
  const unfinished = children.filter(c => !isDoneStatus(c.status)).length;
  return { total, unfinished };
}

export function canSoftDelete(activeChildren) {
  return activeChildren.length === 0;
}

export function canMarkDone(task, children) {
  if (isDone(task) || isContinuous(task)) return false;
  if (children.length === 0) return true;
  return children.every(c => isDoneStatus(c.status));
}

export function joinUsersWithRoles(profiles, roles) {
  const roleMap = {};
  for (const r of roles) {
    if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
    roleMap[r.user_id].push(r.role);
  }
  return profiles.map(p => ({ ...p, roles: roleMap[p.id] || [] }));
}

// --- Todo page helpers ---

export function buildTaskMap(tasks) {
  const map = new Map();
  for (const t of tasks) map.set(t.id, t);
  return map;
}

export function buildChildrenMap(tasks) {
  const map = new Map();
  for (const t of tasks) {
    const pid = t.parent_id || null;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid).push(t);
  }
  for (const children of map.values()) {
    children.sort((a, b) => a.position - b.position);
  }
  return map;
}

export function findFirstNonDoneLeaf(taskId, childrenMap) {
  const children = childrenMap.get(taskId) || [];
  for (const child of children) {
    const grandChildren = childrenMap.get(child.id) || [];
    if (grandChildren.length === 0) {
      if (!isDoneStatus(child.status)) return child;
      continue;
    }
    const result = findFirstNonDoneLeaf(child.id, childrenMap);
    if (result) return result;
  }
  return null;
}

export function findFirstNonDonePath(taskId, childrenMap) {
  const children = childrenMap.get(taskId) || [];
  for (const child of children) {
    const descendantPath = findFirstNonDonePath(child.id, childrenMap);
    if (!isDoneStatus(child.status)) {
      if (descendantPath.length > 0) return [child, ...descendantPath];
      return [child];
    }
    if (descendantPath.length > 0) return descendantPath;
  }
  return [];
}

export function computeTodoTasks(tasks, taskMap, childrenMap) {
  const todoIds = new Set();
  for (const task of tasks) {
    if (Array.isArray(task.tags) && task.tags.includes('#Todo')) {
      todoIds.add(task.id);
    }
    if (isContinuous(task)) {
      todoIds.add(task.id);
      const path = findFirstNonDonePath(task.id, childrenMap);
      for (const pathTask of path) {
        todoIds.add(pathTask.id);
      }
    }
  }
  // Return in DFS order (matches planner hierarchy traversal)
  const ordered = [];
  (function dfs(parentId) {
    const children = childrenMap.get(parentId) || [];
    for (const child of children) {
      if (todoIds.has(child.id)) ordered.push(child);
      dfs(child.id);
    }
  })(null);
  return ordered;
}

export function buildParentChain(taskId, taskMap) {
  const chain = [];
  let current = taskMap.get(taskId);
  let depth = 0;
  while (current && current.parent_id && depth < 100) {
    const parent = taskMap.get(current.parent_id);
    if (!parent) break;
    chain.unshift({ id: parent.id, title: parent.title });
    current = parent;
    depth++;
  }
  return chain;
}
