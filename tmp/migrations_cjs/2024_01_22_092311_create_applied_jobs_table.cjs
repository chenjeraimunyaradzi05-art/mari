// Auto-generated from 2024_01_22_092311_create_applied_jobs_table.php
exports.up = function(knex) {
  return knex.schema.createTable('applied_jobs', function(table) {
    table.bigIncrements('id');
    table.bigInteger('job_id').unsigned().notNullable();
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.foreign('job_id').references('id').inTable('jobs');
    table.foreign('candidate_id').references('id').inTable('candidates');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('applied_jobs');
};
