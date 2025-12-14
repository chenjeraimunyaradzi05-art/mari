
// Ported from 2025_10_30_000003_create_org_media_assets_table.php
exports.up = function(knex) {
  return knex.schema.createTable('org_media_assets', function(table) {
    table.increments('id').primary();
    table.integer('org_page_id').unsigned().references('id').inTable('organization_pages').onDelete('CASCADE');
    table.enu('type', ['video','image']).index();
    table.string('storage_path');
    table.integer('duration').nullable();
    table.string('captions_path').nullable();
    table.json('safety_labels').nullable();
    table.enu('status', ['uploaded','processing','ready','rejected']).defaultTo('uploaded').index();
    table.timestamps(true, true);
    table.index(['org_page_id','status']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('org_media_assets');
};
