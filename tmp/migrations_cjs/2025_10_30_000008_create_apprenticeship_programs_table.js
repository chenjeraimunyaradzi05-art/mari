
// Ported from 2025_10_30_000008_create_apprenticeship_programs_table.php
exports.up = function(knex) {
  return knex.schema.createTable('apprenticeship_programs', function(table) {
    table.increments('id').primary();
    table.integer('org_page_id').unsigned().references('id').inTable('organization_pages').onDelete('CASCADE');
    table.string('framework').nullable();
    table.string('level').nullable();
    table.string('rto_code').nullable();
    table.json('competencies').nullable();
    table.timestamps(true, true);
    table.index(['org_page_id','rto_code']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('apprenticeship_programs');
};
