// Auto-generated from 2025_11_03_000006_create_follows_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('follows'))) {
    await knex.schema.createTable('follows', (table) => {
      table.bigIncrements('id');
      table.bigInteger('follower_id').unsigned().notNullable();
      table.bigInteger('followed_id').unsigned().notNullable();
      table.timestamps(true, true);
    });
    await knex.schema.alterTable('follows', (table) => {
      table.unique(['follower_id','followed_id']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('follows');
};
