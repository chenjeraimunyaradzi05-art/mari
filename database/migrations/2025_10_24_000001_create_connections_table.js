// Auto-generated from 2025_10_24_000001_create_connections_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('connections'))) {
    await knex.schema.createTable('connections', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.bigInteger('connected_user_id').unsigned().notNullable();
      table.string('status').notNullable().defaultTo('pending');
      table.string('type').nullable();
      table.bigInteger('initiator_id').unsigned().nullable();
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('connections');
};
