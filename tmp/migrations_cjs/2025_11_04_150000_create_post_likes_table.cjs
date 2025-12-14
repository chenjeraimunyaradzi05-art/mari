// Auto-generated from 2025_11_04_150000_create_post_likes_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('post_likes'))) {
    await knex.schema.createTable('post_likes', (table) => {
      table.bigIncrements('id');
      table.bigInteger('post_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();
      table.timestamps(true, true);

      table.unique(['post_id', 'user_id']);
      table.index('created_at');
      table.foreign('post_id').references('id').inTable('posts').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('post_likes');
};
