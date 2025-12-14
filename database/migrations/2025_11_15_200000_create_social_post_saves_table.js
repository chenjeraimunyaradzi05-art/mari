// Auto-generated from 2025_11_15_200000_create_social_post_saves_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_post_saves'))) {
    await knex.schema.createTable('social_post_saves', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_post_id').unsigned().notNullable();
      table.foreign('social_post_id').references('social_posts.id').onDelete('CASCADE');
      table.bigInteger('social_profile_id').unsigned().notNullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.timestamp('saved_at').defaultTo(knex.fn.now());

      table.unique(['social_post_id', 'social_profile_id']);
      table.index(['social_profile_id', 'saved_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_post_saves');
};
