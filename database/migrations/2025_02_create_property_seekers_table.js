// Auto-generated from 2025_02_create_property_seekers_table.php
exports.up = function(knex) {
  return knex.schema.createTable('property_seekers', function(table) {
    table.bigIncrements('id');
    table.bigInteger('user_id').unsigned().comment('FK to users - property seeker');
    table.enu('seeker_type', ['renter', 'buyer', 'investor']);
    table.json('location_preferences').nullable();
    table.json('property_type_preferences').nullable();
    table.decimal('min_budget', 12, 2).nullable();
    table.decimal('max_budget', 12, 2).nullable();
    table.integer('min_bedrooms').nullable();
    table.integer('max_bedrooms').nullable();
    table.integer('min_bathrooms').nullable();
    table.integer('max_bathrooms').nullable();
    table.decimal('min_area', 10, 2).nullable();
    table.decimal('max_area', 10, 2).nullable();
    table.json('must_have_features').nullable();
    table.json('nice_to_have_features').nullable();
    table.enu('furnishing_preference', ['unfurnished', 'partially_furnished', 'furnished', 'any']).defaultTo('any');
    table.boolean('allows_pets').nullable();
    table.boolean('needs_parking').defaultTo(false);
    table.integer('preferred_move_in_days').nullable();
    table.json('lifestyle_preferences').nullable();
    table.json('ai_profile').nullable();
    table.json('match_history').nullable();
    table.integer('profile_completion_percentage').defaultTo(0);
    table.integer('total_views_received').defaultTo(0);
    table.integer('total_matches_found').defaultTo(0);
    table.integer('inquiries_sent').defaultTo(0);
    table.boolean('is_active').defaultTo(true);
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.unique('user_id');
    table.index('seeker_type');
    table.index('min_budget');
    table.index('max_budget');
    table.index('is_active');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('property_seekers');
};
