// Auto-generated from 2025_05_27_000002_create_service_listing_leads_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('service_listing_leads');
  if (exists) return;

  const hasLeadTable = await knex.schema.hasTable('leads');

  await knex.schema.createTable('service_listing_leads', (table) => {
    table.bigIncrements('id');
    table.bigInteger('service_listing_id').unsigned().notNullable().comment('FK to service_listings');
    table.bigInteger('user_id').unsigned().nullable().comment('FK to users');
    table.bigInteger('lead_id').unsigned().nullable().comment('FK to leads');
    table.string('contact_name').nullable();
    table.string('contact_email').nullable();
    table.string('contact_phone').nullable();
    table.string('source').notNullable().defaultTo('women_marketplace');
    table.string('status').notNullable().defaultTo('new');
    table.text('notes').nullable();
    table.json('metadata').nullable();
    table.timestamps(true, true);

    table.foreign('service_listing_id').references('id').inTable('service_listings').onDelete('CASCADE');
    table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
    if (hasLeadTable) {
      table.foreign('lead_id').references('id').inTable('leads').onDelete('SET NULL');
    } else {
      table.index('lead_id');
    }
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('service_listing_leads');
};
