// Auto-generated from 2025_11_07_000001_create_analytics_events_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('analytics_events'))) {
    await knex.schema.createTable('analytics_events', (table) => {
      table.bigIncrements('id');
      table.string('event', 120).notNullable();
      table.json('properties').nullable();
      table.json('metadata').nullable();
      table.string('source').nullable();
      table.timestamp('received_at').nullable();
      table.timestamps(true, true);

      table.index('event');
      table.index('source');
      table.index('received_at');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('analytics_events');
};
