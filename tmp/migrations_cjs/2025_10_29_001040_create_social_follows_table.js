// Auto-generated from 2025_10_29_001040_create_social_follows_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_follows')) return;
  await knex.schema.createTable('social_follows', (table) => {
    table.bigIncrements('id');
    table.bigInteger('follower_id').unsigned().notNullable();
    table.string('followable_type');
    table.bigInteger('followable_id').unsigned();
    table.timestamp('followed_at').defaultTo(knex.fn.now());
    table.timestamps(true, true);

    table.foreign('follower_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique(['follower_id', 'followable_type', 'followable_id'], 'social_follows_unique');
    table.index(['followable_type', 'followable_id'], 'social_follows_followable_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_follows');
};
