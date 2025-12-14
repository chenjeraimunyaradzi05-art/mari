// Auto-generated from 2024_01_15_063950_add_softdelete_to_jobs_table.php
exports.up = async function(knex) {
  // Add deleted_at column to jobs for soft deletes
  if (!await knex.schema.hasColumn('jobs', 'deleted_at')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.timestamp('deleted_at').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasColumn('jobs', 'deleted_at')) {
    await knex.schema.alterTable('jobs', function(table) {
      table.dropColumn('deleted_at');
    });
  }
};
