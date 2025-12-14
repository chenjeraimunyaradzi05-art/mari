
// Ported from 2025_10_30_000009_create_leads_table.php
exports.up = function(knex) {
  return knex.schema.createTable('leads', function(table) {
    table.increments('id').primary();
    table.integer('org_page_id').unsigned().references('id').inTable('organization_pages').onDelete('CASCADE');
    table.enu('type', ['course','apprenticeship','job','general']).index();
    table.json('payload');
    table.string('source').nullable();
    table.string('status').defaultTo('new').index();
    table.bigInteger('assigned_to').unsigned().nullable().index();
    table.json('utm').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('leads');
};
