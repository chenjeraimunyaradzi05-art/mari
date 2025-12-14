// Auto-generated from 2025_11_06_030400_create_onboarding_events_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('onboarding_events'))) {
    await knex.schema.createTable('onboarding_events', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('action').notNullable();
      table.json('payload').nullable();
      table.timestamp('occurred_at').defaultTo(knex.fn.now()).notNullable();
      table.timestamps(true, true);

      table.index(['user_id', 'action']);
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('onboarding_events');
};
