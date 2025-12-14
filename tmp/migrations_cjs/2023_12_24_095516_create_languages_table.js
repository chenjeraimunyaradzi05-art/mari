// Auto-generated from 2023_12_24_095516_create_languages_table.php
exports.up = function(knex) {
  return knex.schema.createTable('languages', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('languages');
};
