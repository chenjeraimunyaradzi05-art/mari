
// Ported from 2025_10_30_000011_create_ad_creatives_table.php
exports.up = function(knex) {
  return knex.schema.createTable('ad_creatives', function(table) {
    table.increments('id').primary();
    table.integer('campaign_id').unsigned().references('id').inTable('ad_campaigns').onDelete('CASCADE');
    table.bigInteger('media_id').unsigned();
    table.string('caption', 500).nullable();
    table.string('cta', 80).nullable();
    table.string('deeplink', 500).nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ad_creatives');
};
