// Auto-generated from 2025_10_29_001060_create_social_moderation_events_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_moderation_events')) return;
  await knex.schema.createTable('social_moderation_events', (table) => {
    table.bigIncrements('id');
    table.bigInteger('social_post_id').unsigned().notNullable();
    table.string('event_type', 40).notNullable();
    table.string('actor_type', 30).notNullable().defaultTo('system');
    table.bigInteger('actor_id').unsigned().nullable();
    table.json('payload').nullable();
    table.timestamp('occurred_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.foreign('social_post_id').references('id').inTable('social_posts').onDelete('CASCADE');
    table.index(['social_post_id', 'occurred_at'], 'sme_post_occurred_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_moderation_events');
};
