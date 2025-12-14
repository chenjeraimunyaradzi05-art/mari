// Auto-generated from 2025_11_01_000200_add_workflow_columns_to_jobs_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('jobs', 'workflow_stage');
  const __has_col_up_1 = await knex.schema.hasColumn('jobs', 'workflow_status');
  const __has_col_up_2 = await knex.schema.hasColumn('jobs', 'workflow_priority');
  const __has_col_up_3 = await knex.schema.hasColumn('jobs', 'workflow_submitted_at');
  const __has_col_up_4 = await knex.schema.hasColumn('jobs', 'workflow_reviewed_at');
  const __has_col_up_5 = await knex.schema.hasColumn('jobs', 'workflow_last_transition_at');
  const __has_col_up_6 = await knex.schema.hasColumn('jobs', 'workflow_reviewer_id');
  const __has_col_up_7 = await knex.schema.hasColumn('jobs', 'workflow_notes');
  const __has_col_up_8 = await knex.schema.hasColumn('jobs', 'workflow_payload');
  const __has_col_up_9 = await knex.schema.hasColumn('jobs', 'workflow_source');
  const __has_col_up_10 = await knex.schema.hasColumn('jobs', 'workflow_auto_publish_at');
  const __has_col_up_11 = await knex.schema.hasColumn('jobs', 'workflow_auto_archive_at');
  const __has_col_up_12 = await knex.schema.hasColumn('jobs', col);

  const __has_col_up_0 = __has_col_up_0;
  const __has_col_up_1 = __has_col_up_1;
  const __has_col_up_2 = __has_col_up_2;
  const __has_col_up_3 = __has_col_up_3;
  const __has_col_up_4 = __has_col_up_4;
  const __has_col_up_5 = __has_col_up_5;
  const __has_col_up_6 = __has_col_up_6;
  const __has_col_up_7 = __has_col_up_7;
  const __has_col_up_8 = __has_col_up_8;
  const __has_col_up_9 = __has_col_up_9;
  const __has_col_up_10 = __has_col_up_10;
  const __has_col_up_11 = __has_col_up_11;
  const __has_col_up_12 = __has_col_up_12;

  const added = { workflow_stage: false, workflow_status: false };

  await knex.schema.alterTable('jobs', function(table) {
    // Use conditional checks in JS
  });

  // We need to inspect and add columns one-by-one because alterTable callbacks don't provide hasColumn
  if (!__has_col_up_0) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_stage', 50).notNullable().defaultTo('draft');
    });
    added.workflow_stage = true;
  }

  if (!__has_col_up_1) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_status', 50).notNullable().defaultTo('pending_review');
    });
    added.workflow_status = true;
  }

  if (!__has_col_up_2) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_priority', 20).notNullable().defaultTo('normal');
    });
  }

  if (!__has_col_up_3) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_submitted_at').nullable();
    });
  }

  if (!__has_col_up_4) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_reviewed_at').nullable();
    });
  }

  if (!__has_col_up_5) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_last_transition_at').nullable();
    });
  }

  if (!__has_col_up_6) {
    await knex.schema.alterTable('jobs', function(table) {
      table.bigInteger('workflow_reviewer_id').unsigned().nullable();
      table.foreign('workflow_reviewer_id').references('id').inTable('admins').onDelete('SET NULL');
    });
  }

  if (!__has_col_up_7) {
    await knex.schema.alterTable('jobs', function(table) {
      table.text('workflow_notes').nullable();
    });
  }

  if (!__has_col_up_8) {
    await knex.schema.alterTable('jobs', function(table) {
      table.json('workflow_payload').nullable();
    });
  }

  if (!__has_col_up_9) {
    await knex.schema.alterTable('jobs', function(table) {
      table.string('workflow_source', 50).notNullable().defaultTo('dashboard');
    });
  }

  if (!__has_col_up_10) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('workflow_auto_publish_at').nullable();
    });
  }

  if (!__has_col_up_11) {
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
  if (__has_col_up_6) {
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
    if (__has_col_up_12) existing.push(col);
  }
  if (existing.length > 0) {
    await knex.schema.alterTable('jobs', function(table) {
      table.dropColumn(existing);
    });
  }
};
