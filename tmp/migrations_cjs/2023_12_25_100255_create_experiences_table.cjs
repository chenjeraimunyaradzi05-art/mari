// Auto-generated from 2023_12_25_100255_create_experiences_table.php
exports.up = function(knex) {
  return knex.schema.createTable('experiences', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('experiences');
};
