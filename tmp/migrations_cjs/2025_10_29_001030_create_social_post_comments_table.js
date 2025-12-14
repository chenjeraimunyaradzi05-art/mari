// Auto-generated from 2025_10_29_001030_create_social_post_comments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_post_comments')) return;
  await knex.schema.createTable('social_post_comments', (table) => {
    table.bigIncrements('id');
    table.bigInteger('social_post_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().notNullable();
    table.bigInteger('social_profile_id').unsigned().nullable();
    table.bigInteger('parent_id').unsigned().nullable();
    table.text('content').notNullable();
    table.json('meta').nullable();
    table.timestamps(true, true);

    table.foreign('social_post_id').references('id').inTable('social_posts').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    // parent_id FK to same table
    table.foreign('parent_id').references('id').inTable('social_post_comments').onDelete('CASCADE');
    table.index('social_profile_id');
    table.index(['social_post_id', 'created_at'], 'spc_post_created_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_post_comments');
};
