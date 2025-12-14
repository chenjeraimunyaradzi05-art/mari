// Auto-generated from 2025_11_01_000200_add_workflow_columns_to_jobs_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const added = { workflow_stage: false, workflow_status: false };

  await knex.schema.alterTable('jobs', function(table) {
    // Use conditional checks in JS
  });

  // We need to inspect and add columns one-by-one because alterTable callbacks don't provide hasColumn
  if (!await knex.schema.hasColumn('jobs', 'workflow_stage')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_stage', 50).notNullable().defaultTo('draft');
    });
    added.workflow_stage = true;
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_status')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_status', 50).notNullable().defaultTo('pending_review');
    });
    added.workflow_status = true;
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_priority')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_priority', 20).notNullable().defaultTo('normal');
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_submitted_at')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_submitted_at').nullable();
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_reviewed_at')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_reviewed_at').nullable();
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_last_transition_at')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_last_transition_at').nullable();
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_reviewer_id')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.bigInteger('workflow_reviewer_id').unsigned().nullable();
      table.foreign('workflow_reviewer_id').references('id').inTable('admins').onDelete('SET NULL');
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_notes')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.text('workflow_notes').nullable();
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_payload')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.json('workflow_payload').nullable();
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_source')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_source', 50).notNullable().defaultTo('dashboard');
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_auto_publish_at')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_auto_publish_at').nullable();
    });
  }

  if (!await knex.schema.hasColumn('jobs', 'workflow_auto_archive_at')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_auto_archive_at').nullable();
    });
  }

  if (added.workflow_stage || added.workflow_status) {
    // Apply updates similar to the Laravel DB::table update with CASE statements
    await knex('jobs').update({
      workflow_stage: knex.raw("CASE WHEN status = 'active' THEN 'published' WHEN status = 'expired' THEN 'archived' ELSE 'review' END"),
      workflow_status: knex.raw("CASE WHEN status = 'active' THEN 'approved' WHEN status = 'expired' THEN 'approved' ELSE 'pending_review' END"),
      workflow_priority: knex.raw("COALESCE(workflow_priority, 'normal')"),
      workflow_submitted_at: knex.raw("COALESCE(workflow_submitted_at, created_at)"),
      workflow_reviewed_at: knex.raw("CASE WHEN status IN ('active', 'expired') THEN COALESCE(updated_at, created_at) ELSE workflow_reviewed_at END"),
      workflow_last_transition_at: knex.raw("COALESCE(workflow_last_transition_at, updated_at, created_at)"),
      workflow_source: knex.raw("COALESCE(workflow_source, 'dashboard')"),
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasColumn('jobs', 'workflow_reviewer_id')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.dropForeign(['workflow_reviewer_id']);
    });
  }

  const columns = [
    'workflow_auto_archive_at',
    'workflow_auto_publish_at',
    'workflow_source',
    'workflow_payload',
    'workflow_notes',
    'workflow_reviewer_id',
    'workflow_last_transition_at',
    'workflow_reviewed_at',
    'workflow_submitted_at',
    'workflow_priority',
    'workflow_status',
    'workflow_stage',
  ];

  const existing = [];
  for (const col of columns) {
    if (await knex.schema.hasColumn('jobs', col)) existing.push(col);
  }
  if (existing.length > 0) {
    await knex.schema.alterTable('jobs', function(table) {
      table.dropColumn(existing);
    });
  }
};
