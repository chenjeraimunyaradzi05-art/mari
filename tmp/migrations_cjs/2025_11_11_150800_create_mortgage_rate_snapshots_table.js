// Auto-generated from 2025_11_11_150800_create_mortgage_rate_snapshots_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('mortgage_rate_snapshots'))) {
    await knex.schema.createTable('mortgage_rate_snapshots', (table) => {
      table.bigIncrements('id');
      table.string('provider').notNullable();
      table.string('product_name').notNullable();
      table.enu('rate_type', ['fixed', 'variable', 'split', 'introductory']).notNullable().defaultTo('fixed');
      table.specificType('term_months', 'smallint unsigned').notNullable();
      table.decimal('interest_rate', 5, 3).notNullable();
      table.decimal('comparison_rate', 5, 3).nullable();
      table.decimal('apr', 5, 3).nullable();
      table.specificType('max_lvr', 'tinyint unsigned').nullable();
      table.specificType('min_deposit_percent', 'tinyint unsigned').nullable();
      table.enu('available_to', ['owner_occupier', 'investor', 'first_home']).notNullable().defaultTo('owner_occupier');
      table.string('market_region', 10).notNullable().defaultTo('AU');
      table.json('feature_flags').nullable();
      table.timestamp('captured_at').nullable();
      table.string('source').nullable();
      table.timestamps(true, true);

      table.index(['provider', 'rate_type']);
      table.index(['market_region', 'available_to']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('mortgage_rate_snapshots');
};
