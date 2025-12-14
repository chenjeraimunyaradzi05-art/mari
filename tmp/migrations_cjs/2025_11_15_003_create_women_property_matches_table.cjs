// Auto-generated from 2025_11_15_003_create_women_property_matches_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('women_property_matches'))) {
    await knex.schema.createTable('women_property_matches', (table) => {
      table.bigIncrements('id');
      table.bigInteger('property_seeker_id').unsigned().notNullable();
      table.bigInteger('rental_property_id').unsigned().nullable();
      table.bigInteger('listing_id').unsigned().nullable();
      table.bigInteger('landlord_user_id').unsigned().nullable();
      table.decimal('match_score', 5, 2).notNullable();
      table.json('match_reasons').nullable();
      table.json('match_breakdown').nullable();
      table.enu('match_status', ['matched','viewed','inquired','rejected','archived']).defaultTo('matched');
      table.timestamp('viewed_at').nullable();
      table.timestamp('inquired_at').nullable();
      table.text('seeker_note').nullable();
      table.integer('relevance_rank').nullable();
      table.boolean('is_ai_recommended').defaultTo(true);
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('property_seeker_id').references('women_property_seekers.id').onDelete('CASCADE');
      table.foreign('rental_property_id').references('women_rental_properties.id').onDelete('CASCADE');
      table.foreign('listing_id').references('women_listings.id').onDelete('CASCADE');
      table.foreign('landlord_user_id').references('users.id').onDelete('SET NULL');
      table.index('property_seeker_id');
      table.index('match_score');
      table.index('match_status');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_property_matches');
};
