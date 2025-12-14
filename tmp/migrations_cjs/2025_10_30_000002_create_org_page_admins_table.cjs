
// Ported from 2025_10_30_000002_create_org_page_admins_table.php
exports.up = function(knex) {
  return knex.schema.createTable('org_page_admins', function(table) {
    table.increments('id').primary();
    table.integer('org_page_id').unsigned().references('id').inTable('organization_pages').onDelete('CASCADE');
    table.integer('user_id').unsigned().references('id').inTable('users').onDelete('CASCADE');
    table.string('role').defaultTo('admin');
    table.timestamps(true, true);
    table.unique(['org_page_id', 'user_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('org_page_admins');
};
