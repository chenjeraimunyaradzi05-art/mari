// Auto-generated from 2024_01_09_065443_create_job_types_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_types', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_types');
};
