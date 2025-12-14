// Auto-generated from 2025_11_11_130000_create_women_housing_listings_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('women_housing_listings'))) {
    await knex.schema.createTable('women_housing_listings', (table) => {
      table.bigIncrements('id');
      table.uuid('uuid').unique();
      table.bigInteger('owner_user_id').unsigned().notNullable();
      table.bigInteger('agent_profile_id').unsigned().nullable();
      table.string('title').notNullable();
      table.string('slug').notNullable().unique();
      table.enu('listing_type', ['rent_shared','rent_private','buy','investment']).notNullable().defaultTo('rent_shared');
      table.enu('audience', ['women_only','women_students','women_professionals','women_caregivers','women_retirees']).notNullable().defaultTo('women_only');
      table.text('description').nullable();
      table.bigInteger('price_cents').unsigned().nullable();
      table.string('currency', 3).notNullable().defaultTo('AUD');
      table.bigInteger('bond_cents').unsigned().nullable();
      table.boolean('mortgage_required').notNullable().defaultTo(false);
      table.json('location').nullable();
      table.json('amenities').nullable();
      table.date('availability_date').nullable();
      table.enu('verification_status', ['pending','verified','rejected']).notNullable().defaultTo('pending');
      table.enu('moderation_status', ['clean','flagged','under_review']).notNullable().defaultTo('clean');
      table.enu('visibility', ['public','community','private']).notNullable().defaultTo('community');
      table.json('ai_tags').nullable();
      table.float('ai_recommendation_score').notNullable().defaultTo(0);
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['owner_user_id', 'visibility']);
      table.index(['listing_type', 'audience']);
      table.foreign('owner_user_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('agent_profile_id').references('id').inTable('agent_profiles').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_housing_listings');
};
