// Auto-generated from 2025_11_15_000004_create_social_likes_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_likes'))) {
    await knex.schema.createTable('social_likes', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_profile_id').unsigned().notNullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.string('likeable_type').notNullable();
      table.bigInteger('likeable_id').unsigned().notNullable();
      table.timestamp('liked_at').notNullable();

      table.unique(['social_profile_id', 'likeable_type', 'likeable_id'], 'social_likes_unique_like');
      table.index(['likeable_type', 'likeable_id', 'liked_at'], 'social_likes_likeable_index');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_likes');
};
