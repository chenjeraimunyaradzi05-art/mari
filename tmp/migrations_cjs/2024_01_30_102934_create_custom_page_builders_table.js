// Auto-generated from 2024_01_30_102934_create_custom_page_builders_table.php
exports.up = function(knex) {
  return knex.schema.createTable('custom_page_builders', function(table) {
    table.bigIncrements('id');
    table.string('page_name');
    table.string('slug');
    table.text('content');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('custom_page_builders');
};
