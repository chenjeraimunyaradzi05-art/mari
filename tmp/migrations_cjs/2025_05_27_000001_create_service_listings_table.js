// Auto-generated from 2025_05_27_000001_create_service_listings_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('service_listings');
  if (exists) return;

  const hasOrganizationPages = await knex.schema.hasTable('organization_pages');

  await knex.schema.createTable('service_listings', (table) => {
    table.bigIncrements('id');
    table.uuid('uuid').unique();
    table.string('name').notNullable();
    table.string('slug').unique().notNullable();
    table.bigInteger('user_id').unsigned().nullable().comment('FK to users');
    table.bigInteger('org_page_id').unsigned().nullable().comment('FK to organization_pages');
    table.string('category').notNullable();
    table.string('city').nullable();
    table.string('state', 8).nullable();
    table.string('country', 3).notNullable().defaultTo('AU');
    table.string('location_slug').nullable();
    table.text('description').nullable();
    table.json('modalities').nullable();
    table.json('availability_options').nullable();
    table.json('perks').nullable();
    table.json('tags').nullable();
    table.string('hero_image').nullable();
    table.string('price_tier').nullable();
    table.string('price_copy').nullable();
    table.string('booking_cta').nullable();
    table.decimal('rating', 3, 2).nullable();
    table.integer('review_count').unsigned().notNullable().defaultTo(0);
    table.boolean('is_sponsored').notNullable().defaultTo(false);
    table.timestamp('published_at').nullable();
    table.timestamp('featured_until').nullable();
    table.json('metadata').nullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();

    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    if (hasOrganizationPages) {
      table.foreign('org_page_id').references('id').inTable('organization_pages').onDelete('SET NULL');
    } else {
      table.index('org_page_id');
    }

    table.index('location_slug');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('service_listings');
};
