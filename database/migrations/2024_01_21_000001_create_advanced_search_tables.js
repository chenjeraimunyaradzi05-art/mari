// Auto-generated from 2024_01_21_000001_create_advanced_search_tables.php
exports.up = async function(knex) {
  if (!await knex.schema.hasTable('saved_searches')) {
    await knex.schema.createTable('saved_searches', function(table) {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('user_type');
      table.string('name');
      table.string('search_type');
      table.json('filters');
      table.integer('alert_frequency').nullable();
      table.timestamp('last_alerted_at').nullable();
      table.timestamps(true, true);
      table.index(['user_id', 'user_type']);
      table.index('search_type');
    });
  }

  if (!await knex.schema.hasTable('search_history')) {
    await knex.schema.createTable('search_history', function(table) {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().nullable();
      table.string('query');
      table.string('search_type');
      table.integer('results_count').defaultTo(0);
      table.json('filters').nullable();
      table.string('ip_address').nullable();
      table.string('user_agent').nullable();
      table.timestamp('created_at');
      table.index(['user_id', 'created_at']);
      table.index('search_type');
      table.index('created_at');
    });
  }

  if (!await knex.schema.hasTable('search_suggestions')) {
    await knex.schema.createTable('search_suggestions', function(table) {
      table.bigIncrements('id');
      table.string('term');
      table.string('suggestion_type');
      table.integer('popularity').defaultTo(0);
      table.json('metadata').nullable();
      table.timestamps(true, true);
      table.index(['term', 'suggestion_type']);
      table.index('popularity');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('search_suggestions');
  await knex.schema.dropTableIfExists('search_history');
  await knex.schema.dropTableIfExists('saved_searches');
};
