// Auto-generated from 2025_10_29_001050_create_social_post_impressions_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_post_impressions')) return;
  await knex.schema.createTable('social_post_impressions', (table) => {
    table.bigIncrements('id');
    table.bigInteger('social_post_id').unsigned().notNullable();
    table.bigInteger('user_id').unsigned().nullable();
    table.string('source', 40).notNullable().defaultTo('feed');
    table.json('meta').nullable();
    table.timestamp('viewed_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.foreign('social_post_id').references('id').inTable('social_posts').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    table.index(['social_post_id', 'viewed_at'], 'spi_post_viewed_idx');
    table.index(['user_id', 'viewed_at'], 'spi_user_viewed_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_post_impressions');
};
