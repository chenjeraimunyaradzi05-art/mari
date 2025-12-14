
// Ported from 2025_10_30_000001_create_organization_pages_table.php
exports.up = function(knex) {
  return knex.schema.createTable('organization_pages', function(table) {
    table.increments('id').primary();
    table.bigInteger('org_id').unsigned().nullable().index();
    table.enu('type', ['university','tafe','rto','employer','tradie','government','association']).index();
    table.string('slug').unique();
    table.string('name');
    table.string('tagline').nullable();
    table.bigInteger('cover_media_id').unsigned().nullable();
    table.enu('verification_status', ['unverified','pending','verified']).defaultTo('unverified').index();
    table.specificType('safety_score', 'TINYINT UNSIGNED').defaultTo(0);
    table.timestamps(true, true);
    table.specificType('FULLTEXT', '(name, tagline)'); // Note: MySQL fulltext index workaround may be needed
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('organization_pages');
};
