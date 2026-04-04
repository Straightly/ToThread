import jsYaml from 'js-yaml';

/**
 * Build task trees for an array of visible tasks (with recursive children).
 * @param {Array} visibleTasks - The tasks currently shown on the page
 * @param {object} insforge - InsForge client instance
 * @param {boolean} includeDone - Whether to include Done tasks in subtrees
 * @returns {Array} Array of task tree objects matching YAML export format
 */
export async function buildTaskTrees(visibleTasks, insforge, includeDone) {
  const results = [];
  for (const task of visibleTasks) {
    const children = await fetchChildrenRecursive(task.id, insforge, includeDone);
    results.push(formatTask(task, children));
  }
  return results;
}

async function fetchChildrenRecursive(parentId, insforge, includeDone) {
  let query = insforge.database
    .from('tasks')
    .select('*')
    .eq('parent_id', parentId)
    .is('deleted_at', null)
    .order('position', { ascending: true });

  if (!includeDone) {
    query = query.neq('status', 'Done');
  }

  const { data, error } = await query;
  if (error || !data) return [];

  const results = [];
  for (const task of data) {
    const grandchildren = await fetchChildrenRecursive(task.id, insforge, includeDone);
    results.push(formatTask(task, grandchildren));
  }
  return results;
}

function formatTask(task, children) {
  const obj = {
    title: task.title,
    status: task.status,
    id: task.id,
  };

  if (task.description) obj.description = task.description;
  if (task.result) obj.result = task.result;
  if (task.tags && task.tags.length > 0) obj.tags = task.tags;

  // Flatten custom_fields as direct keys
  if (task.custom_fields && typeof task.custom_fields === 'object') {
    for (const [key, value] of Object.entries(task.custom_fields)) {
      obj[key] = value;
    }
  }

  obj.tasks = children;
  return obj;
}

/**
 * Serialize task trees to YAML string.
 */
export function tasksToYaml(taskTrees) {
  return jsYaml.dump(taskTrees, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
}

/**
 * Trigger a browser download of a YAML string.
 */
export function downloadYaml(yamlString, filename) {
  const blob = new Blob([yamlString], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
