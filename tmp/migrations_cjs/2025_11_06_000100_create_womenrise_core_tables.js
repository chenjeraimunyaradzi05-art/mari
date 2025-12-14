// Auto-generated from 2025_11_06_000100_create_womenrise_core_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('housing_listings'))) {
    await knex.schema.createTable('housing_listings', (table) => {
      table.bigIncrements('id');
      table.uuid('uuid').unique();
      table.bigInteger('org_page_id').unsigned().nullable();
      table.bigInteger('landlord_user_id').unsigned().nullable();
      table.string('title').notNullable();
      table.string('slug').notNullable().unique();
      table.enu('listing_type', ['rent','share','buy']).notNullable().defaultTo('rent');
      table.string('property_type').nullable();
      table.boolean('furnished').notNullable().defaultTo(false);
      table.integer('bedrooms').unsigned().nullable();
      table.integer('bathrooms').unsigned().nullable();
      table.integer('parking_spaces').unsigned().nullable();
      table.bigInteger('rent_cents').unsigned().nullable();
      table.enu('rent_frequency', ['weekly','fortnightly','monthly']).notNullable().defaultTo('weekly');
      table.bigInteger('bond_cents').unsigned().nullable();
      table.string('currency', 3).notNullable().defaultTo('AUD');
      table.date('available_from').nullable();
      table.string('occupancy_preference').nullable();
      table.enu('safety_level', ['pending','verified','flagged']).notNullable().defaultTo('pending');
      table.json('amenities').nullable();
      table.json('house_rules').nullable();
      table.json('safety_features').nullable();
      table.string('address_line1').nullable();
      table.string('address_line2').nullable();
      table.string('suburb').nullable();
      table.string('region').nullable();
      table.string('postcode', 12).nullable();
      table.string('country', 2).nullable();
      table.decimal('latitude', 10, 7).nullable();
      table.decimal('longitude', 10, 7).nullable();
      table.enu('status', ['draft','published','archived']).notNullable().defaultTo('draft').index();
      table.enu('verification_status', ['pending','verified','rejected']).notNullable().defaultTo('pending').index();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['org_page_id', 'status']);
      table.foreign('org_page_id').references('id').inTable('organization_pages').onDelete('SET NULL');
      table.foreign('landlord_user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('mentorship_programs'))) {
    await knex.schema.createTable('mentorship_programs', (table) => {
      table.bigIncrements('id');
      table.uuid('uuid').unique();
      table.bigInteger('org_page_id').unsigned().nullable();
      table.bigInteger('mentor_user_id').unsigned().nullable();
      table.string('title').notNullable();
      table.string('slug').notNullable().unique();
      table.string('focus_area').nullable();
      table.enu('delivery_mode', ['virtual','in_person','hybrid']).nullable();
      table.integer('capacity').unsigned().nullable();
      table.integer('duration_minutes').unsigned().nullable();
      table.bigInteger('price_cents').unsigned().nullable();
      table.string('currency', 3).notNullable().defaultTo('AUD');
      table.decimal('revenue_share', 5, 2).notNullable().defaultTo(20.00);
      table.json('matching_criteria').nullable();
      table.json('impact_metrics').nullable();
      table.enu('status', ['draft','published','archived']).notNullable().defaultTo('draft').index();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('org_page_id').references('id').inTable('organization_pages').onDelete('SET NULL');
      table.foreign('mentor_user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('mentorship_sessions'))) {
    await knex.schema.createTable('mentorship_sessions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('program_id').unsigned().notNullable();
      table.bigInteger('mentor_user_id').unsigned().nullable();
      table.bigInteger('mentee_user_id').unsigned().nullable();
      table.dateTime('scheduled_for').nullable();
      table.integer('duration_minutes').unsigned().notNullable().defaultTo(60);
      table.enu('status', ['pending','scheduled','completed','cancelled']).notNullable().defaultTo('pending').index();
      table.string('meeting_link').nullable();
      table.json('notes').nullable();
      table.timestamps(true, true);

      table.foreign('program_id').references('id').inTable('mentorship_programs').onDelete('CASCADE');
      table.foreign('mentor_user_id').references('id').inTable('users').onDelete('SET NULL');
      table.foreign('mentee_user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('incident_reports'))) {
    await knex.schema.createTable('incident_reports', (table) => {
      table.bigIncrements('id');
      table.uuid('uuid').unique();
      table.bigInteger('reporter_user_id').unsigned().notNullable();
      table.bigInteger('subject_user_id').unsigned().nullable();
      table.bigInteger('org_page_id').unsigned().nullable();
      table.string('category').index();
      table.enu('severity', ['low','medium','high','critical']).notNullable().defaultTo('medium').index();
      table.text('description').notNullable();
      table.enu('status', ['open','in_review','resolved','escalated','closed']).notNullable().defaultTo('open').index();
      table.json('metadata').nullable();
      table.timestamp('occurred_at').nullable();
      table.timestamp('resolved_at').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.foreign('reporter_user_id').references('id').inTable('users').onDelete('CASCADE');
      table.foreign('subject_user_id').references('id').inTable('users').onDelete('SET NULL');
      table.foreign('org_page_id').references('id').inTable('organization_pages').onDelete('SET NULL');
    });
  }

  if (!(await knex.schema.hasTable('incident_events'))) {
    await knex.schema.createTable('incident_events', (table) => {
      table.bigIncrements('id');
      table.bigInteger('incident_id').unsigned().notNullable();
      table.bigInteger('author_user_id').unsigned().nullable();
      table.string('action').notNullable();
      table.text('notes').nullable();
      table.timestamps(true, true);

      table.foreign('incident_id').references('id').inTable('incident_reports').onDelete('CASCADE');
      table.foreign('author_user_id').references('id').inTable('users').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('incident_events');
  await knex.schema.dropTableIfExists('incident_reports');
  await knex.schema.dropTableIfExists('mentorship_sessions');
  await knex.schema.dropTableIfExists('mentorship_programs');
  await knex.schema.dropTableIfExists('housing_listings');
};
