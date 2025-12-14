
// Ported from 2025_10_30_000006_create_courses_table.php
exports.up = function(knex) {
  return knex.schema.createTable('courses', function(table) {
    table.increments('id').primary();
    table.integer('provider_org_page_id').unsigned().references('id').inTable('organization_pages').onDelete('CASCADE');
    table.string('code').nullable();
    table.string('title');
    table.enu('type', ['bachelor','masters','micro','tafe_cert','tafe_diploma','short','apprenticeship']).index();
    table.enu('mode', ['on_campus','online','hybrid']).index();
    table.string('location').nullable();
    table.integer('duration_weeks').unsigned().nullable();
    table.bigInteger('cost_cents').unsigned().nullable();
    table.json('funding').nullable();
    table.json('prerequisites').nullable();
    table.json('outcomes').nullable();
    table.json('tags').nullable();
    table.timestamps(true, true);
    // Fulltext index on title may require raw SQL in MySQL
    table.index(['provider_org_page_id','type']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('courses');
};
