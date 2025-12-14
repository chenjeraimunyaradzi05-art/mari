// Auto-generated from 2025_10_24_000002_create_posts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('posts'))) {
    await knex.schema.createTable('posts', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.text('content').notNullable();
      table.string('media').nullable();
      table.string('type').nullable();
      table.string('visibility').notNullable().defaultTo('public');
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('posts');
};
