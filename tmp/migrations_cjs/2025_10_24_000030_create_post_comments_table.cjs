// Auto-generated from 2025_10_24_000030_create_post_comments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('post_comments'))) {
    await knex.schema.createTable('post_comments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('post_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().notNullable();
      table.text('content', 'longtext').notNullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('post_id').references('id').inTable('posts').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');

      table.index('post_id');
      table.index('user_id');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('post_comments');
};
