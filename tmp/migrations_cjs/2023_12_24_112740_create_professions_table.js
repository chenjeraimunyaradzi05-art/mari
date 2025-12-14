// Auto-generated from 2023_12_24_112740_create_professions_table.php
exports.up = function(knex) {
  return knex.schema.createTable('professions', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('professions');
};
