import jsYaml from 'js-yaml';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(str) {
  return typeof str === 'string' && UUID_RE.test(str);
}

/**
 * Parse YAML string and extract the tasks array.
 * Handles both formats:
 *   - Raw array (our export)
 *   - Wrapped object with .tasks key (original ToThread app)
 */
function parseYamlTasks(yamlString) {
  const parsed = jsYaml.load(yamlString);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tasks)) return parsed.tasks;
  throw new Error('Unrecognized YAML format: expected an array or an object with a "tasks" key');
}

const KNOWN_FIELDS = new Set(['title', 'status', 'id', 'description', 'result', 'tags', 'tasks']);

/**
 * Separate a parsed task object into standard DB fields, custom fields, and children.
 */
function separateFields(taskObj) {
  const standard = {};
  const customFields = {};
  let children = [];

  for (const [key, value] of Object.entries(taskObj)) {
    if (key === 'tasks') {
      children = Array.isArray(value) ? value : [];
    } else if (KNOWN_FIELDS.has(key)) {
      standard[key] = value;
    } else {
      customFields[key] = value;
    }
  }

  return { standard, customFields, children };
}

/**
 * Recursively collect all valid UUIDs from a task tree.
 */
function collectAllIds(nodes) {
  const ids = [];
  for (const node of nodes) {
    if (isValidUuid(node.id)) ids.push(node.id);
    if (Array.isArray(node.tasks) && node.tasks.length > 0) {
      ids.push(...collectAllIds(node.tasks));
    }
  }
  return ids;
}

/**
 * Batch-check which IDs already exist in the database for this user.
 * Includes soft-deleted tasks (no deleted_at filter) since PK would conflict.
 */
async function checkExistingIds(insforge, userId, ids) {
  if (ids.length === 0) return new Set();
  const { data } = await insforge.database
    .from('tasks')
    .select('id')
    .eq('user_id', userId)
    .in('id', ids);
  return new Set((data || []).map(r => r.id));
}

/**
 * Get the current max position among non-deleted siblings of parentId.
 * Returns -1 if no siblings exist.
 */
async function getMaxPosition(insforge, userId, parentId) {
  let query = insforge.database
    .from('tasks')
    .select('position')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('position', { ascending: false })
    .limit(1);

  if (parentId === null) {
    query = query.is('parent_id', null);
  } else {
    query = query.eq('parent_id', parentId);
  }

  const { data } = await query;
  return data && data.length > 0 ? data[0].position : -1;
}

/**
 * Import tasks from a YAML string into the database.
 *
 * @param {string} yamlString - Raw YAML file content
 * @param {object} insforge - InsForge client instance
 * @param {string} userId - Current user's UUID
 * @param {string|null} rootParentId - Parent ID at current navigation level (null = root)
 * @returns {{ importedCount: number }}
 */
export async function importTasksFromYaml(yamlString, insforge, userId, rootParentId) {
  const taskNodes = parseYamlTasks(yamlString);
  if (!taskNodes || taskNodes.length === 0) return { importedCount: 0 };

  const allUuids = collectAllIds(taskNodes);
  const existingIds = await checkExistingIds(insforge, userId, allUuids);
  const maxPos = await getMaxPosition(insforge, userId, rootParentId);

  let importedCount = 0;

  async function insertRecursive(nodes, parentId, positionOffset) {
    let pos = positionOffset + 1;

    for (const node of nodes) {
      const { standard, customFields, children } = separateFields(node);

      // Skip entire subtree if this task's UUID already exists
      if (isValidUuid(standard.id) && existingIds.has(standard.id)) {
        continue;
      }

      // Normalize tags
      let tags = standard.tags || null;
      if (tags !== null && !Array.isArray(tags)) {
        tags = [String(tags)];
      }

      const row = {
        user_id: userId,
        parent_id: parentId,
        title: standard.title || 'Untitled',
        status: standard.status || 'Pending',
        position: pos,
        description: standard.description || null,
        result: standard.result || null,
        tags,
        custom_fields: Object.keys(customFields).length > 0 ? customFields : {},
      };

      // Preserve valid UUID if it doesn't already exist
      if (isValidUuid(standard.id)) {
        row.id = standard.id;
      }

      const { data, error } = await insforge.database
        .from('tasks')
        .insert([row])
        .select('id');

      if (error || !data || data.length === 0) {
        // Silent skip on insert failure
        continue;
      }

      const insertedId = data[0].id;
      existingIds.add(insertedId);
      pos++;
      importedCount++;

      // Recurse into children
      if (children.length > 0) {
        await insertRecursive(children, insertedId, -1);
      }
    }
  }

  await insertRecursive(taskNodes, rootParentId, maxPos);

  return { importedCount };
}
