// Auto-generated from 2025_03_create_ai_property_matches_table.php
exports.up = function(knex) {
  return knex.schema.createTable('ai_property_matches', function(table) {
    table.bigIncrements('id');
    table.bigInteger('property_seeker_id').unsigned().comment('FK to property_seekers');
    table.bigInteger('rental_property_id').unsigned().nullable().comment('FK to rental_properties');
    table.bigInteger('property_id').unsigned().nullable().comment('FK to properties for buy');
    table.bigInteger('landlord_user_id').unsigned().nullable().comment('For social context');
    table.decimal('match_score', 5, 2).comment('0-100 match percentage');
    table.json('match_reasons');
    table.json('match_breakdown');
    table.enu('match_status', ['matched','viewed','inquired','rejected','archived']).defaultTo('matched');
    table.timestamp('viewed_at').nullable();
    table.timestamp('inquired_at').nullable();
    table.text('seeker_note').nullable().comment("Seeker's note on match");
    table.integer('relevance_rank').nullable();
    table.boolean('is_ai_recommended').defaultTo(true);
    table.timestamps(true, true);
    table.foreign('property_seeker_id').references('id').inTable('property_seekers').onDelete('CASCADE');
    table.foreign('rental_property_id').references('id').inTable('rental_properties').onDelete('CASCADE');
    table.foreign('landlord_user_id').references('id').inTable('users').onDelete('SET NULL');
    table.index('property_seeker_id');
    table.index('match_score');
    table.index('match_status');
    table.index(['property_seeker_id', 'match_score']);
    table.index('is_ai_recommended');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ai_property_matches');
};
