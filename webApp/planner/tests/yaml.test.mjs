import assert from 'node:assert/strict';
import test from 'node:test';
import { load, YAML11_SCHEMA } from 'js-yaml';
import { tasksToYaml } from '../src/lib/exportTask.js';
import { importTasksFromYaml } from '../src/lib/importTask.js';

function mockDatabase() {
  const rows = [];
  return {
    rows,
    database: {
      from(table) {
        assert.equal(table, 'tasks');
        let inserted;
        const query = {
          select() { return query; },
          eq() { return query; },
          in() { return query; },
          is() { return query; },
          order() { return query; },
          limit() { return query; },
          insert(values) {
            inserted = values.map(row => ({ ...row, id: row.id || `task-${rows.length}` }));
            rows.push(...inserted);
            return query;
          },
          then(resolve, reject) {
            return Promise.resolve({ data: inserted || [], error: null }).then(resolve, reject);
          },
        };
        return query;
      },
    },
  };
}

test('YAML export preserves nested tasks, strings, multiline text, and custom fields', () => {
  const tasks = [{
    title: 'yes', status: 'Pending', id: 'parent',
    description: 'First line\nSecond line\n', tags: ['on', '2026-10-16'],
    estimate: 2.5, scheduled: new Date('2026-10-16T12:00:00Z'),
    tasks: [{ title: '00123', status: 'Done', id: 'child', tasks: [] }],
  }];
  assert.deepEqual(load(tasksToYaml(tasks), { schema: YAML11_SCHEMA }), tasks);
});

test('exported task trees import with parent links and custom fields intact', async () => {
  const client = mockDatabase();
  const tasks = [{ title: 'Parent', status: 'Pending', effort: 'Research', tasks: [
    { title: 'Child', status: 'Done', tags: ['review'], tasks: [] },
  ] }];
  const result = await importTasksFromYaml(tasksToYaml(tasks), client, 'user-1', null);
  assert.equal(result.importedCount, 2);
  assert.equal(client.rows[0].parent_id, null);
  assert.equal(client.rows[1].parent_id, client.rows[0].id);
  assert.deepEqual(client.rows[0].custom_fields, { effort: 'Research' });
  assert.equal(client.rows[1].status, 'Done');
  assert.deepEqual(client.rows[1].tags, ['review']);
});

test('wrapped YAML remains supported and invalid documents do not write tasks', async () => {
  const client = mockDatabase();
  const result = await importTasksFromYaml('tasks:\n  - title: Wrapped\n', client, 'user-1', null);
  assert.equal(result.importedCount, 1);
  await assert.rejects(importTasksFromYaml('title: Not a task list', client, 'user-1', null));
  await assert.rejects(importTasksFromYaml('', client, 'user-1', null));
  assert.equal(client.rows.length, 1);
});
