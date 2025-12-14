// Auto-generated from 2025_11_12_000001_create_mortgage_intelligence_access_logs_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('mortgage_intelligence_access_logs'))) {
    await knex.schema.createTable('mortgage_intelligence_access_logs', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().nullable();
      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      table.bigInteger('women_housing_listing_id').unsigned().notNullable();
      table.string('channel', 32).notNullable();
      table.json('meta').nullable();
      table.timestamp('accessed_at').notNullable();
      table.timestamps(true, true);

      table.foreign('women_housing_listing_id', 'mia_logs_listing_fk').references('women_housing_listings.id').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('mortgage_intelligence_access_logs');
};
