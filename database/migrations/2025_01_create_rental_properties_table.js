// Auto-generated from 2025_01_create_rental_properties_table.php
exports.up = function(knex) {
  return knex.schema.createTable('rental_properties', function(table) {
    table.bigIncrements('id');
    table.bigInteger('property_id').unsigned().comment('FK to properties table');
    table.bigInteger('landlord_user_id').unsigned().comment('FK to users - property owner');
    table.decimal('monthly_rent', 12, 2).comment('Monthly rental price');
    table.decimal('security_deposit', 12, 2).nullable().comment('Security deposit amount');
    table.enu('furnishing', ['unfurnished', 'partially_furnished', 'furnished']).defaultTo('unfurnished');
    table.enu('lease_term', ['monthly','quarterly','semi-annual','annual','flexible']).defaultTo('annual');
    table.integer('min_lease_months').defaultTo(12).comment('Minimum lease duration in months');
    table.integer('max_lease_months').nullable().comment('Maximum lease duration, null = no limit');
    table.date('available_from').comment('Earliest occupancy date');
    table.date('available_until').nullable().comment('Latest occupancy date, null = ongoing');
    table.json('ai_preferences').nullable().comment('AI-learned tenant preferences');
    table.text('house_rules').nullable().comment('Rental rules and conditions');
    table.boolean('allows_pets').defaultTo(false);
    table.boolean('allows_smoking').defaultTo(false);
    table.boolean('allows_visitors').defaultTo(true);
    table.integer('max_occupants').nullable().comment('Maximum number of tenants allowed');
    table.json('utilities_included').nullable().comment('Which utilities are included in rent');
    table.integer('views_count').defaultTo(0);
    table.integer('inquiry_count').defaultTo(0);
    table.decimal('avg_rating', 3, 2).nullable().comment('Average tenant review rating');
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();
    table.foreign('landlord_user_id').references('id').inTable('users').onDelete('RESTRICT');
    table.index('landlord_user_id');
    table.index('property_id');
    table.index('available_from');
    table.index('furnishing');
    table.index('lease_term');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('rental_properties');
};
