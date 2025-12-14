// Auto-generated from 2024_01_26_create_marital_statuses_table.php
exports.up = function(knex) {
  return knex.schema.createTable('marital_statuses', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('marital_statuses');
};
