// Auto-generated from 2025_10_29_001010_create_social_post_media_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_post_media')) return;
  await knex.schema.createTable('social_post_media', (table) => {
    table.bigIncrements('id');
    table.bigInteger('social_post_id').unsigned().notNullable();
    table.string('media_type', 30).notNullable();
    table.string('path').notNullable();
    table.json('meta').nullable();
    table.smallint('position').unsigned().notNullable().defaultTo(0);
    table.timestamps(true, true);

    table.foreign('social_post_id').references('id').inTable('social_posts').onDelete('CASCADE');
    table.index(['social_post_id', 'position'], 'spm_post_position_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_post_media');
};
