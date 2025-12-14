// Auto-generated from 2025_11_03_000005_create_comments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('comments'))) {
    await knex.schema.createTable('comments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.bigInteger('post_id').unsigned().notNullable();
      table.text('body').notNullable();
      table.bigInteger('parent_id').unsigned().nullable();
      table.timestamps(true, true);
    });
    // FKs
    if (await knex.schema.hasTable('users')) {
      await knex.schema.alterTable('comments', (table) => {
        table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
      });
    }
    if (await knex.schema.hasTable('posts')) {
      await knex.schema.alterTable('comments', (table) => {
        table.foreign('post_id').references('id').inTable('posts').onDelete('CASCADE');
      });
    }
    if (await knex.schema.hasTable('comments')) {
      await knex.schema.alterTable('comments', (table) => {
        table.foreign('parent_id').references('id').inTable('comments').onDelete('CASCADE');
      });
    }
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('comments');
};
