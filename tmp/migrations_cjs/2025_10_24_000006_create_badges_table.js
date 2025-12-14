// Auto-generated from 2025_10_24_000006_create_badges_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('badges'))) {
    await knex.schema.createTable('badges', (table) => {
      table.bigIncrements('id');
      table.string('name').notNullable();
      table.string('description').nullable();
      table.string('icon').nullable();
      table.json('criteria').nullable();
      table.bigInteger('user_id').unsigned().nullable();
      table.timestamp('awarded_at').nullable();
      table.timestamps(true, true);

      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.index(['user_id', 'awarded_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('badges');
};
