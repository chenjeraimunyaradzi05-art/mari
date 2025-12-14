// Auto-generated from 2023_12_20_061004_create_countries_table.php
exports.up = function(knex) {
  return knex.schema.createTable('countries', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('countries');
};
