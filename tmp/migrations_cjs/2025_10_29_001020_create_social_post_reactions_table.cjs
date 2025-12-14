// Auto-generated from 2025_10_29_001020_create_social_post_reactions_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_post_reactions')) return;
  await knex.schema.createTable('social_post_reactions', (table) => {
    table.bigIncrements('id');
    table.bigInteger('social_post_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().notNullable();
    table.string('reaction', 30).notNullable().defaultTo('like');
    table.timestamps(true, true);

    table.foreign('social_post_id').references('id').inTable('social_posts').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['social_post_id', 'user_id', 'reaction'], 'spr_unique_user_reaction');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_post_reactions');
};
