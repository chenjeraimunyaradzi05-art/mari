// Auto-generated from 2024_02_01_031615_create_footers_table.php
exports.up = function(knex) {
  return knex.schema.createTable('footers', function(table) {
    table.bigIncrements('id');
    table.string('logo');
    table.string('copyright');
    table.text('details');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('footers');
};
