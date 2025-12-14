// Auto-generated from 2025_05_create_rental_inquiries_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('rental_inquiries');
  if (exists) return;

  await knex.schema.createTable('rental_inquiries', (table) => {
    table.bigIncrements('id');
    table.bigInteger('rental_property_id').unsigned().notNullable().comment('FK to rental_properties');
    table.bigInteger('property_seeker_id').unsigned().notNullable().comment('FK to property_seekers');
    table.bigInteger('landlord_user_id').unsigned().notNullable().comment('FK to users - landlord');
    table.text('inquiry_message').notNullable().comment("Tenant's inquiry message");
    table.enu('status', ['pending', 'interested', 'rejected', 'scheduled', 'accepted']).notNullable().defaultTo('pending');
    table.integer('priority_score').notNullable().defaultTo(0).comment('AI-calculated priority for landlord');
    table.timestamp('responded_at').nullable();
    table.text('landlord_response').nullable();
    table.timestamp('scheduled_tour_at').nullable();
    table.timestamp('tour_completed_at').nullable();
    table.timestamps(true, true);

    table.foreign('rental_property_id').references('id').inTable('rental_properties').onDelete('CASCADE');
    table.foreign('property_seeker_id').references('id').inTable('property_seekers').onDelete('CASCADE');
    table.foreign('landlord_user_id').references('id').inTable('users').onDelete('RESTRICT');

    table.index('rental_property_id');
    table.index('property_seeker_id');
    table.index('status');
    table.index('priority_score');
    table.index('created_at');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('rental_inquiries');
};
