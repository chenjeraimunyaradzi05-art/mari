// Auto-generated from 2024_01_15_063950_add_softdelete_to_jobs_table.php
exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('jobs', 'deleted_at');

  const __has_col_up_0 = __has_col_up_0;

  // Add deleted_at column to jobs for soft deletes
  if (!__has_col_up_0) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('deleted_at').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (__has_col_up_0) {
    await knex.schema.alterTable('jobs', function(table) {
      table.dropColumn('deleted_at');
    });
  }
};
