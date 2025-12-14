
// Ported from 2025_10_30_000010_create_ad_campaigns_table.php
exports.up = function(knex) {
  return knex.schema.createTable('ad_campaigns', function(table) {
    table.increments('id').primary();
    table.integer('org_page_id').unsigned().references('id').inTable('organization_pages').onDelete('CASCADE');
    table.enu('objective', ['reach','traffic','leads','applications']).index();
    table.bigInteger('budget_cents').unsigned().defaultTo(0);
    table.date('start_on').index();
    table.date('end_on').nullable().index();
    table.json('targeting').nullable();
    table.enu('status', ['draft','active','paused','completed']).defaultTo('draft').index();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('ad_campaigns');
};
