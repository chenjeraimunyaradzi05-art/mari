// Auto-generated from 2025_11_15_000002_create_social_media_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_media'))) {
    await knex.schema.createTable('social_media', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_post_id').unsigned().notNullable();
      table.foreign('social_post_id').references('social_posts.id').onDelete('CASCADE');
      table.string('media_type').notNullable();
      table.string('file_path').notNullable();
      table.string('thumbnail_path').nullable();
      table.string('mime_type').notNullable();
      table.integer('file_size').nullable();
      table.integer('width').nullable();
      table.integer('height').nullable();
      table.integer('duration').nullable();
      table.integer('order').defaultTo(0);
      table.json('ai_analysis').nullable();
      table.json('filters').nullable();
      table.timestamps(true, true);

      table.index(['social_post_id', 'order']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_media');
};
