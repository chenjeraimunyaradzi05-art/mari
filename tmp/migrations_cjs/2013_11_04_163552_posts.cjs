// Auto-generated from vendor/cviebrock tests 2013_11_04_163552_posts.php

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('posts'))) {
    await knex.schema.createTable('posts', (table) => {
      table.increments('id');
      table.string('title').notNullable();
      table.string('subtitle').nullable();
      table.string('slug').nullable();
      table.string('dummy').nullable();
      table.integer('author_id').nullable();
      table.timestamp('deleted_at').nullable();
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('posts');
};
