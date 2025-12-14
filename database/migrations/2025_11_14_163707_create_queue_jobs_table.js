// Auto-generated from 2025_11_14_163707_create_queue_jobs_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('queue_jobs'))) {
    await knex.schema.createTable('queue_jobs', (table) => {
      table.bigIncrements('id');
      table.string('queue').defaultTo('default');
      table.text('payload', 'longtext');
      table.specificType('attempts', 'tinyint unsigned');
      table.integer('reserved_at').unsigned().nullable();
      table.integer('available_at').unsigned().notNullable();
      table.integer('created_at').unsigned().notNullable();
      table.index(['queue', 'reserved_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('queue_jobs');
};
