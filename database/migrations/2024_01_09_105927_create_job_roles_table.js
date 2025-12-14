// Auto-generated from 2024_01_09_105927_create_job_roles_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_roles', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_roles');
};
