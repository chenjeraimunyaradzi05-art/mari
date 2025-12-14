// Auto-generated from 2025_11_11_150600_create_listing_partnership_intentions_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('listing_partnership_intentions'))) {
    await knex.schema.createTable('listing_partnership_intentions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('women_housing_listing_id').unsigned().notNullable();
      table.bigInteger('initiator_user_id').unsigned().notNullable();
      table.enu('intent_type', ['co_rent','co_buy','co_develop']).notNullable().defaultTo('co_rent');
      table.bigInteger('budget_range_min_cents').unsigned().nullable();
      table.bigInteger('budget_range_max_cents').unsigned().nullable();
      table.enu('preferred_finance_type', ['mortgage','cash','shared_equity','rent']).nullable();
      table.json('skills_offered').nullable();
      table.string('availability_window').nullable();
      table.enu('status', ['pending','matched','withdrawn','expired']).notNullable().defaultTo('pending');
      table.binary('ai_match_vector').nullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.index(['women_housing_listing_id', 'status'], 'listing_partnership_intentions_listing_status_idx');
      table.index(['initiator_user_id']);
      table.foreign('women_housing_listing_id').references('id').inTable('women_housing_listings').onDelete('CASCADE');
      table.foreign('initiator_user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('listing_partnership_intentions');
};
