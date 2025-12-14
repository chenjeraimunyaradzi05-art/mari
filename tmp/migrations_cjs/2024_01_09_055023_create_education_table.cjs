// Auto-generated from 2024_01_09_055023_create_education_table.php
exports.up = function(knex) {
  return knex.schema.createTable('education', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('education');
};
