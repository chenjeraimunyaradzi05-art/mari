// Auto-generated from 2025_11_15_000005_create_social_comments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_comments'))) {
    await knex.schema.createTable('social_comments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_post_id').unsigned().notNullable();
      table.foreign('social_post_id').references('social_posts.id').onDelete('CASCADE');
      table.bigInteger('social_profile_id').unsigned().notNullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('CASCADE');
      table.bigInteger('parent_id').unsigned().nullable();
      table.foreign('parent_id').references('social_comments.id').onDelete('CASCADE');
      table.text('content').notNullable();
      table.json('mentions').nullable();
      table.integer('likes_count').defaultTo(0);
      table.integer('replies_count').defaultTo(0);
      table.boolean('is_pinned').defaultTo(false);
      table.json('ai_sentiment').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['social_post_id', 'created_at']);
      table.index(['parent_id', 'created_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_comments');
};
