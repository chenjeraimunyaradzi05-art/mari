// Auto-generated from 2025_11_11_101200_create_mortgage_rates_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('mortgage_rates'))) {
    await knex.schema.createTable('mortgage_rates', (table) => {
      table.bigIncrements('id');
      table.string('lender_name').notNullable();
      table.string('product_name').nullable();
      table.enu('rate_type', ['fixed', 'variable', 'introductory', 'interest_only', 'line_of_credit']).notNullable().defaultTo('fixed');
      table.integer('term_months').unsigned().nullable();
      table.decimal('interest_rate', 5, 3).notNullable();
      table.decimal('comparison_rate', 5, 3).nullable();
      table.decimal('apr', 5, 3).nullable();
      table.decimal('max_lvr', 5, 2).nullable();
      table.bigInteger('min_loan_amount').unsigned().nullable();
      table.bigInteger('max_loan_amount').unsigned().nullable();
      table.date('effective_date').notNullable();
      table.date('expiry_date').nullable();
      table.json('features').nullable();
      table.json('eligibility_criteria').nullable();
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.index(['lender_name', 'rate_type']);
      table.index(['rate_type', 'term_months']);
      table.index(['effective_date', 'expiry_date']);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('mortgage_rates');
};
