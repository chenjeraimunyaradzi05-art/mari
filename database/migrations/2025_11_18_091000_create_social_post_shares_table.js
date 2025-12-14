// Auto-generated from 2025_11_18_091000_create_social_post_shares_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_post_shares'))) {
    await knex.schema.createTable('social_post_shares', (table) => {
      table.bigIncrements('id');
      table.bigInteger('social_post_id').unsigned().notNullable();
      table.foreign('social_post_id').references('social_posts.id').onDelete('CASCADE');
      table.bigInteger('social_profile_id').unsigned().nullable();
      table.foreign('social_profile_id').references('social_profiles.id').onDelete('SET NULL');
      table.bigInteger('user_id').unsigned().nullable();
      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      table.string('channel', 30).notNullable();
      table.json('meta').nullable();
      table.timestamp('shared_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index(['social_post_id', 'shared_at'], 'social_post_shares_post_shared_idx');
      table.index(['channel', 'shared_at'], 'social_post_shares_channel_idx');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_post_shares');
};
