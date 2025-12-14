// Auto-generated from 2024_01_26_create_religions_table.php
exports.up = function(knex) {
  return knex.schema.createTable('religions', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('religions');
};
