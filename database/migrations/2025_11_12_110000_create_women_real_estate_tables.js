// Auto-generated from 2025_11_12_110000_create_women_real_estate_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  // women_listing_categories
  if (!(await knex.schema.hasTable('women_listing_categories'))) {
    await knex.schema.createTable('women_listing_categories', (table) => {
      table.bigIncrements('id');
      table.string('slug').unique();
      table.string('name').notNullable();
      table.string('description').nullable();
      table.string('icon').nullable();
      table.timestamps(true, true);
    });
  }

  // women_listing_locations
  if (!(await knex.schema.hasTable('women_listing_locations'))) {
    await knex.schema.createTable('women_listing_locations', (table) => {
      table.bigIncrements('id');
      table.bigInteger('parent_id').unsigned().nullable();
      table.foreign('parent_id').references('women_listing_locations.id');
      table.string('name').notNullable();
      table.string('slug').unique();
      table.string('type').defaultTo('suburb');
      table.decimal('latitude', 10, 7).nullable();
      table.decimal('longitude', 10, 7).nullable();
      table.timestamps(true, true);
    });
  }

  // women_verified_agents
  if (!(await knex.schema.hasTable('women_verified_agents'))) {
    await knex.schema.createTable('women_verified_agents', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.foreign('user_id').references('users.id').onDelete('CASCADE');
      table.string('license_number').notNullable();
      table.date('license_expires_at').nullable();
      table.string('regulator').nullable();
      table.string('status').defaultTo('pending');
      table.json('verification_payload').nullable();
      table.timestamp('verified_at').nullable();
      table.timestamps(true, true);

      table.unique('user_id');
    });
  }

  // women_listings
  if (!(await knex.schema.hasTable('women_listings'))) {
    await knex.schema.createTable('women_listings', (table) => {
      table.bigIncrements('id');
      table.uuid('uuid').unique();
      table.bigInteger('owner_id').unsigned().notNullable();
      table.foreign('owner_id').references('users.id');
      table.bigInteger('agent_id').unsigned().nullable();
      table.foreign('agent_id').references('women_verified_agents.id');
      table.bigInteger('category_id').unsigned().nullable();
      table.foreign('category_id').references('women_listing_categories.id');
      table.bigInteger('location_id').unsigned().nullable();
      table.foreign('location_id').references('women_listing_locations.id');
      table.string('title').notNullable();
      table.string('slug').notNullable().unique();
      table.string('intent').notNullable();
      table.string('primary_audience').notNullable();
      table.json('audience_overrides').nullable();
      table.text('summary').notNullable();
      table.text('description').nullable();
      table.json('features').nullable();
      table.integer('bedrooms').unsigned().nullable();
      table.integer('bathrooms').unsigned().nullable();
      table.integer('car_spaces').unsigned().nullable();
      table.decimal('price', 16, 2).nullable();
      table.string('price_frequency').nullable();
      table.string('currency', 3).defaultTo('AUD');
      table.boolean('is_verified').defaultTo(false);
      table.boolean('is_ai_safe').defaultTo(false);
      table.json('ai_insights').nullable();
      table.timestamp('published_at').nullable();
      table.timestamp('expires_at').nullable();
      table.timestamps(true, true);

      table.index(['owner_id', 'intent']);
      table.index(['primary_audience', 'published_at']);
      table.index(['location_id']);
    });
  }

  // women_listing_media
  if (!(await knex.schema.hasTable('women_listing_media'))) {
    await knex.schema.createTable('women_listing_media', (table) => {
      table.bigIncrements('id');
      table.bigInteger('listing_id').unsigned().notNullable();
      table.foreign('listing_id').references('women_listings.id').onDelete('CASCADE');
      table.string('type').defaultTo('image');
      table.string('path').notNullable();
      table.string('caption').nullable();
      table.integer('position').unsigned().defaultTo(0);
      table.json('meta').nullable();
      table.timestamps(true, true);
    });
  }

  // women_listing_audience_pivots
  if (!(await knex.schema.hasTable('women_listing_audience_pivots'))) {
    await knex.schema.createTable('women_listing_audience_pivots', (table) => {
      table.bigIncrements('id');
      table.bigInteger('listing_id').unsigned().notNullable();
      table.foreign('listing_id').references('women_listings.id').onDelete('CASCADE');
      table.string('audience').notNullable();
      table.timestamps(true, true);

      table.unique(['listing_id', 'audience']);
    });
  }

  // women_mortgage_market_rates
  if (!(await knex.schema.hasTable('women_mortgage_market_rates'))) {
    await knex.schema.createTable('women_mortgage_market_rates', (table) => {
      table.bigIncrements('id');
      table.string('source').notNullable().defaultTo('rba');
      table.string('provider').nullable();
      table.string('product_name').notNullable();
      table.decimal('comparison_rate', 5, 3).notNullable();
      table.decimal('variable_rate', 5, 3).nullable();
      table.decimal('fixed_rate', 5, 3).nullable();
      table.integer('fixed_term_years').unsigned().nullable();
      table.string('loan_type').defaultTo('owner_occupied');
      table.string('repayment_type').defaultTo('principal_interest');
      table.json('meta').nullable();
      table.timestamp('effective_at').notNullable();
      table.timestamps(true, true);

      table.index(['source', 'effective_at']);
      table.index(['provider', 'loan_type']);
    });
  }

  // women_listing_mortgage_snapshots
  if (!(await knex.schema.hasTable('women_listing_mortgage_snapshots'))) {
    await knex.schema.createTable('women_listing_mortgage_snapshots', (table) => {
      table.bigIncrements('id');
      table.bigInteger('listing_id').unsigned().notNullable();
      table.foreign('listing_id').references('women_listings.id').onDelete('CASCADE');
      table.bigInteger('rate_id').unsigned().nullable();
      table.foreign('rate_id').references('women_mortgage_market_rates.id').onDelete('SET NULL');
      table.decimal('deposit_required', 12, 2).nullable();
      table.decimal('principal_amount', 16, 2).notNullable();
      table.decimal('comparison_rate', 5, 3).notNullable();
      table.decimal('repayment_weekly', 12, 2).notNullable();
      table.decimal('repayment_monthly', 12, 2).notNullable();
      table.decimal('repayment_fortnightly', 12, 2).notNullable();
      table.string('currency', 3).defaultTo('AUD');
      table.json('ai_commentary').nullable();
      table.timestamps(true, true);
    });
  }

  // women_listing_social_shares
  if (!(await knex.schema.hasTable('women_listing_social_shares'))) {
    await knex.schema.createTable('women_listing_social_shares', (table) => {
      table.bigIncrements('id');
      table.bigInteger('listing_id').unsigned().notNullable();
      table.foreign('listing_id').references('women_listings.id').onDelete('CASCADE');
      table.bigInteger('user_id').unsigned().nullable();
      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      table.string('platform').notNullable();
      table.string('share_url').notNullable();
      table.timestamp('shared_at').notNullable();
      table.json('meta').nullable();
      table.timestamps(true, true);
    });
  }

  // women_listing_partner_intentions
  if (!(await knex.schema.hasTable('women_listing_partner_intentions'))) {
    await knex.schema.createTable('women_listing_partner_intentions', (table) => {
      table.bigIncrements('id');
      table.bigInteger('listing_id').unsigned().nullable();
      table.foreign('listing_id').references('women_listings.id').onDelete('SET NULL');
      table.bigInteger('initiator_id').unsigned().notNullable();
      table.foreign('initiator_id').references('users.id');
      table.bigInteger('invitee_id').unsigned().nullable();
      table.foreign('invitee_id').references('users.id').onDelete('SET NULL');
      table.string('status').defaultTo('pending');
      table.string('intent').defaultTo('co_purchase');
      table.json('preferences').nullable();
      table.text('message').nullable();
      table.timestamp('expires_at').nullable();
      table.timestamps(true, true);

      table.index(['initiator_id', 'status']);
      table.index(['invitee_id', 'status']);
    });
  }

  // women_agent_leads
  if (!(await knex.schema.hasTable('women_agent_leads'))) {
    await knex.schema.createTable('women_agent_leads', (table) => {
      table.bigIncrements('id');
      table.bigInteger('agent_id').unsigned().notNullable();
      table.foreign('agent_id').references('women_verified_agents.id').onDelete('CASCADE');
      table.bigInteger('user_id').unsigned().nullable();
      table.foreign('user_id').references('users.id').onDelete('SET NULL');
      table.bigInteger('listing_id').unsigned().nullable();
      table.foreign('listing_id').references('women_listings.id').onDelete('SET NULL');
      table.string('type').defaultTo('buyer');
      table.string('status').defaultTo('new');
      table.string('source').nullable();
      table.json('payload').nullable();
      table.timestamps(true, true);

      table.index(['agent_id', 'status']);
    });
  }
}

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('women_agent_leads');
  await knex.schema.dropTableIfExists('women_listing_partner_intentions');
  await knex.schema.dropTableIfExists('women_listing_social_shares');
  await knex.schema.dropTableIfExists('women_listing_mortgage_snapshots');
  await knex.schema.dropTableIfExists('women_mortgage_market_rates');
  await knex.schema.dropTableIfExists('women_listing_audience_pivots');
  await knex.schema.dropTableIfExists('women_listing_media');
  await knex.schema.dropTableIfExists('women_listings');
  await knex.schema.dropTableIfExists('women_verified_agents');
  await knex.schema.dropTableIfExists('women_listing_locations');
  await knex.schema.dropTableIfExists('women_listing_categories');
};
