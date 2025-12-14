
// Ported from 2025_10_30_000001_create_organization_pages_table.php
exports.up = async function(knex) {
  await knex.schema.createTable('organization_pages', function(table) {
    table.increments('id').primary();
    table.bigInteger('org_id').unsigned().nullable().index();
    table.enu('type', ['university','tafe','rto','employer','tradie','government','association']).index();
    table.string('slug').unique();
    table.string('name');
    table.string('tagline').nullable();
    table.bigInteger('cover_media_id').unsigned().nullable();
    table.enu('verification_status', ['unverified','pending','verified']).defaultTo('unverified').index();
    if (knex && knex.client && String(knex.client.config.client).includes('sqlite')) {
      table.integer('safety_score').defaultTo(0);
    } else {
      table.specificType('safety_score', 'TINYINT UNSIGNED').defaultTo(0);
    }
    table.timestamps(true, true);
  });

  // Create FULLTEXT index if running on MySQL
  if (knex && knex.client && String(knex.client.config.client).includes('mysql')) {
    try {
      await knex.raw('ALTER TABLE organization_pages ADD FULLTEXT(name, tagline)');
    } catch (e) {
      // best-effort: ignore if not supported
    }
  }
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('organization_pages');
};
