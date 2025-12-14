// Auto-generated from 2024_01_09_092041_create_salary_types_table.php
exports.up = function(knex) {
  return knex.schema.createTable('salary_types', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('salary_types');
};
