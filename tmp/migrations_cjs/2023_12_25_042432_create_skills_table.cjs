// Auto-generated from 2023_12_25_042432_create_skills_table.php
exports.up = function(knex) {
  return knex.schema.createTable('skills', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('skills');
};
