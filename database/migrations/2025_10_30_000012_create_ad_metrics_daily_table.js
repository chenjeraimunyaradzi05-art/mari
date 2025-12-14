
// Ported from 2025_10_30_000012_create_ad_metrics_daily_table.php
exports.up = function(knex) {
  return knex.schema.createTable('ad_metrics_daily', function(table) {
    table.increments('id').primary();
    table.integer('campaign_id').unsigned().references('id').inTable('ad_campaigns').onDelete('CASCADE');
    table.date('date').index();
    table.bigInteger('impressions').unsigned().defaultTo(0);
    table.bigInteger('clicks').unsigned().defaultTo(0);
    table.bigInteger('views').unsigned().defaultTo(0);
    table.bigInteger('watch_time_s').unsigned().defaultTo(0);
    table.bigInteger('leads').unsigned().defaultTo(0);
    table.bigInteger('cost_cents').unsigned().defaultTo(0);
    table.timestamps(true, true);
    table.unique(['campaign_id','date']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ad_metrics_daily');
};
