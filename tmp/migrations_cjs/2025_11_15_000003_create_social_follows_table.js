// Auto-generated from 2025_11_15_000003_create_social_follows_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_follows'))) {
    await knex.schema.createTable('social_follows', (table) => {
      table.bigIncrements('id');
      table.bigInteger('follower_id').unsigned().notNullable();
      table.foreign('follower_id').references('social_profiles.id').onDelete('CASCADE');
      table.bigInteger('following_id').unsigned().notNullable();
      table.foreign('following_id').references('social_profiles.id').onDelete('CASCADE');
      table.boolean('is_close_friend').defaultTo(false);
      table.boolean('notifications_enabled').defaultTo(true);
      table.timestamp('followed_at').notNullable();

      table.unique(['follower_id', 'following_id']);
      table.index(['follower_id', 'followed_at']);
      table.index(['following_id', 'followed_at']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_follows');
};
