// Auto-generated from 2025_11_03_000003_create_posts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('posts'))) {
    await knex.schema.createTable('posts', (table) => {
      table.bigIncrements('id');
      table.string('author_type').notNullable();
      table.bigInteger('author_id').unsigned().notNullable();
      table.text('body').nullable();
      table.string('media_path').nullable();
      table.enu('media_type', ['none','image','video']).defaultTo('none');
      table.enu('visibility', ['public','followers']).defaultTo('public');
      table.text('ai_caption').nullable();
      table.json('ai_tags').nullable();
      table.boolean('is_moderated').notNullable().defaultTo(false);
      table.timestamps(true, true);
    });
    await knex.schema.alterTable('posts', (table) => {
      table.index(['author_type','author_id']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('posts');
};
