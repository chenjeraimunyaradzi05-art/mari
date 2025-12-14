// Auto-generated from 2025_11_03_000004_create_reactions_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('reactions'))) {
    await knex.schema.createTable('reactions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.bigInteger('post_id').unsigned().notNullable();
      table.enu('type', ['like','heart','celebrate','support','useful']).defaultTo('like');
      table.timestamps(true, true);
    });
    // foreign keys
    if (await knex.schema.hasTable('users')) {
      await knex.schema.alterTable('reactions', (table) => {
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      });
    }
    if (await knex.schema.hasTable('posts')) {
      await knex.schema.alterTable('reactions', (table) => {
        table.foreign('post_id').references('id').inTable('posts').onDelete('CASCADE');
      });
    }
    await knex.schema.alterTable('reactions', (table) => {
      table.unique(['user_id','post_id','type']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('reactions');
};
