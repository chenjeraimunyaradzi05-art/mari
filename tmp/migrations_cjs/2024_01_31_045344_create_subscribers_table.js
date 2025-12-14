// Auto-generated from 2024_01_31_045344_create_subscribers_table.php
exports.up = function(knex) {
  return knex.schema.createTable('subscribers', function(table) {
    table.bigIncrements('id');
    table.string('email');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('subscribers');
};
