// Auto-generated from 2025_11_14_163625_create_jobs_table_fresh.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('jobs_backup'))) {
    await knex.schema.createTable('jobs_backup', (table) => {
      table.bigIncrements('id');
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('jobs_backup');
};
