// Auto-generated from 2024_01_10_032256_create_job_experiences_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_experiences', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_experiences');
};
