// Auto-generated from 2025_10_29_001000_create_social_posts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_posts')) return;
  await knex.schema.createTable('social_posts', (table) => {
    table.bigIncrements('id');
    table.string('postable_type');
    table.bigInteger('postable_id').unsigned();
    table.bigInteger('user_id').unsigned().notNullable();
    table.string('type', 30).notNullable().defaultTo('feed');
    table.text('content').nullable();
    table.json('meta').nullable();
    table.string('visibility', 20).notNullable().defaultTo('public');
    table.string('moderation_status', 30).notNullable().defaultTo('pending');
    table.boolean('is_sponsored').notNullable().defaultTo(false);
    table.timestamp('published_at').nullable();
    table.timestamp('pinned_at').nullable();
    table.timestamp('deleted_at').nullable();
    table.timestamps(true, true);

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index(['user_id', 'published_at'], 'social_posts_user_published_idx');
    table.index(['moderation_status', 'published_at'], 'social_posts_moderation_idx');
    table.index(['is_sponsored', 'published_at'], 'social_posts_sponsored_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_posts');
};
