// Auto-generated from 2025_11_15_000001_create_social_posts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_posts'))) {
    await knex.schema.createTable('social_posts', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_profile_id').unsigned().notNullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.enu('post_type', ['post', 'reel', 'story', 'article', 'poll', 'live_stream', 'movie', 'short_video', 'documentary', 'educational', 'success_story']).notNullable();
      table.text('caption').nullable();
      table.json('media').nullable();
      table.string('location').nullable();
      table.json('tags').nullable();
      table.json('mentions').nullable();
      table.integer('likes_count').defaultTo(0);
      table.integer('comments_count').defaultTo(0);
      table.integer('shares_count').defaultTo(0);
      table.integer('views_count').defaultTo(0);
      table.boolean('is_pinned').defaultTo(false);
      table.boolean('comments_disabled').defaultTo(false);
      table.enu('visibility', ['public', 'followers', 'private']).defaultTo('public');
      table.timestamp('published_at').nullable();
      table.timestamp('expires_at').nullable();
      table.float('ai_engagement_score').defaultTo(0);
      table.json('ai_tags').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['social_profile_id', 'published_at']);
      table.index(['post_type', 'visibility']);
    });

    // Add MySQL fulltext index for caption if the client supports it
    const client = knex.client.config.client;
    if (client === 'mysql' || client === 'mysql2') {
      await knex.raw('ALTER TABLE social_posts ADD FULLTEXT INDEX social_posts_caption_fulltext (caption)');
    }
  }
};

exports.down = async function(knex) {
  const client = knex.client.config.client;
  if (client === 'mysql' || client === 'mysql2') {
    try { await knex.raw('ALTER TABLE social_posts DROP INDEX social_posts_caption_fulltext'); } catch (e) { }
  }
  await knex.schema.dropTableIfExists('social_posts');
};
