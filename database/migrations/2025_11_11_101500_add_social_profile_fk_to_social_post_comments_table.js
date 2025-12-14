// Auto-generated from 2025_11_11_101500_add_social_profile_fk_to_social_post_comments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_post_comments')) || !(await knex.schema.hasTable('social_profiles'))) return;

  await knex.schema.alterTable('social_post_comments', (table) => {
    table.foreign('social_profile_id').references('id').inTable('social_profiles').onDelete('SET NULL');
  });
};

exports.down = async function(knex) {
  if (!(await knex.schema.hasTable('social_post_comments'))) return;
  await knex.schema.alterTable('social_post_comments', (table) => {
    table.dropForeign(['social_profile_id']);
  });
};
