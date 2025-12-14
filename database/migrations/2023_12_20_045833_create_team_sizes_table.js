// Auto-generated from 2023_12_20_045833_create_team_sizes_table.php
exports.up = function(knex) {
  return knex.schema.createTable('team_sizes', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('team_sizes');
};
