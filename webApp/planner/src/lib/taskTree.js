export function isAdmin(roles) {
  return Array.isArray(roles) && roles.includes('admin');
}

export function isDone(task) {
  return task.status === 'Done';
}

export function isContinuous(task) {
  return task.status === 'Continuous';
}

export function countChildren(children) {
  const total = children.length;
  const unfinished = children.filter(c => c.status !== 'Done').length;
  return { total, unfinished };
}

export function canSoftDelete(activeChildren) {
  return activeChildren.length === 0;
}

export function canMarkDone(task, children) {
  if (isDone(task) || isContinuous(task)) return false;
  if (children.length === 0) return true;
  return children.every(c => c.status === 'Done');
}

export function joinUsersWithRoles(profiles, roles) {
  const roleMap = {};
  for (const r of roles) {
    if (!roleMap[r.user_id]) roleMap[r.user_id] = [];
    roleMap[r.user_id].push(r.role);
  }
  return profiles.map(p => ({ ...p, roles: roleMap[p.id] || [] }));
}
