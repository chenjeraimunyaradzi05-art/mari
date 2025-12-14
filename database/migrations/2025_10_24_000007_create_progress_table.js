// Auto-generated from 2025_10_24_000007_create_progress_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('progress'))) {
    await knex.schema.createTable('progress', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('type').notNullable();
      table.integer('value').notNullable().defaultTo(0);
      table.integer('target').notNullable().defaultTo(100);
      table.timestamp('completed_at').nullable();
      table.timestamps(true, true);

      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.index(['user_id', 'type']);
      table.unique(['user_id', 'type']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('progress');
};
