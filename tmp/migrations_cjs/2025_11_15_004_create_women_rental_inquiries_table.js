// Auto-generated from 2025_11_15_004_create_women_rental_inquiries_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('women_rental_inquiries'))) {
    await knex.schema.createTable('women_rental_inquiries', (table) => {
      table.bigIncrements('id');
      table.bigInteger('rental_property_id').unsigned().notNullable();
      table.bigInteger('property_seeker_id').unsigned().notNullable();
      table.bigInteger('landlord_user_id').unsigned().notNullable();
      table.text('inquiry_message').notNullable();
      table.enu('status', ['pending','interested','rejected','scheduled','accepted']).defaultTo('pending');
      table.integer('priority_score').defaultTo(0);
      table.timestamp('responded_at').nullable();
      table.text('landlord_response').nullable();
      table.timestamp('scheduled_tour_at').nullable();
      table.timestamp('tour_completed_at').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('rental_property_id').references('women_rental_properties.id').onDelete('CASCADE');
      table.foreign('property_seeker_id').references('women_property_seekers.id').onDelete('CASCADE');
      table.foreign('landlord_user_id').references('users.id').onDelete('RESTRICT');
      table.index('rental_property_id');
      table.index('property_seeker_id');
      table.index('status');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_rental_inquiries');
};
