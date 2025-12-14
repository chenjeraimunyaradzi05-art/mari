// Auto-generated from 2025_11_14_163608_alter_jobs_table_add_queue_column.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasColumn('jobs', 'queue'))) {
    await knex.schema.alterTable('jobs', (table) => {
      table.string('queue').defaultTo('default').after('id');
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasColumn('jobs', 'queue')) {
    await knex.schema.alterTable('jobs', (table) => {
      table.dropColumn('queue');
    });
  }
};
