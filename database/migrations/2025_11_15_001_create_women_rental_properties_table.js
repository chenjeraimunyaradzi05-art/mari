// Auto-generated from 2025_11_15_001_create_women_rental_properties_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('women_rental_properties'))) {
    await knex.schema.createTable('women_rental_properties', (table) => {
      table.bigIncrements('id');
      table.bigInteger('listing_id').unsigned().notNullable();
      table.bigInteger('landlord_user_id').unsigned().notNullable();
      table.decimal('monthly_rent', 12, 2).notNullable();
      table.decimal('security_deposit', 12, 2).nullable();
      table.enu('furnishing', ['unfurnished','partially_furnished','furnished']).defaultTo('unfurnished');
      table.enu('lease_term', ['monthly','quarterly','semi-annual','annual','flexible']).defaultTo('annual');
      table.integer('min_lease_months').defaultTo(12);
      table.integer('max_lease_months').nullable();
      table.date('available_from').notNullable();
      table.date('available_until').nullable();
      table.json('ai_preferences').nullable();
      table.text('house_rules').nullable();
      table.boolean('allows_pets').defaultTo(false);
      table.boolean('allows_smoking').defaultTo(false);
      table.boolean('allows_visitors').defaultTo(true);
      table.integer('max_occupants').nullable();
      table.json('utilities_included').nullable();
      table.integer('views_count').defaultTo(0);
      table.integer('inquiry_count').defaultTo(0);
      table.decimal('avg_rating', 3, 2).nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('listing_id').references('women_listings.id').onDelete('CASCADE');
      table.foreign('landlord_user_id').references('users.id').onDelete('RESTRICT');
      table.index('landlord_user_id');
      table.index('is_active');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_rental_properties');
};
