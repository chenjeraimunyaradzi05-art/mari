// Auto-generated from 2024_01_09_101223_create_tags_table.php
exports.up = function(knex) {
  return knex.schema.createTable('tags', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('tags');
};
