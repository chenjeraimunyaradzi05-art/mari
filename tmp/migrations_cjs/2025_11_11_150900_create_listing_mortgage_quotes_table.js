// Auto-generated from 2025_11_11_150900_create_listing_mortgage_quotes_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('listing_mortgage_quotes'))) {
    await knex.schema.createTable('listing_mortgage_quotes', (table) => {
      table.bigIncrements('id');
      table.bigInteger('women_housing_listing_id').unsigned().notNullable();
      table.foreign('women_housing_listing_id').references('women_housing_listings.id').onDelete('CASCADE');
      table.bigInteger('user_id').unsigned().nullable();
      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      table.bigInteger('mortgage_rate_snapshot_id').unsigned().notNullable();
      table.foreign('mortgage_rate_snapshot_id').references('mortgage_rate_snapshots.id').onDelete('CASCADE');
      table.bigInteger('principal_amount_cents').unsigned().notNullable();
      table.bigInteger('deposit_amount_cents').unsigned().nullable();
      table.specificType('loan_term_months', 'smallint unsigned').notNullable();
      table.enu('repayment_frequency', ['monthly', 'fortnightly', 'weekly']).notNullable().defaultTo('monthly');
      table.bigInteger('calculated_repayment_cents').unsigned().notNullable();
      table.enu('risk_rating', ['low', 'medium', 'high']).nullable();
      table.text('ai_commentary').nullable();
      table.timestamp('generated_at').defaultTo(knex.fn.now());
      table.timestamps(true, true);

      table.index(['women_housing_listing_id', 'generated_at'], 'listing_mortgage_quotes_listing_generated_idx');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('listing_mortgage_quotes');
};
