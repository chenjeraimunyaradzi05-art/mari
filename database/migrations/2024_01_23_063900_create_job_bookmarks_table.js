// Auto-generated from 2024_01_23_063900_create_job_bookmarks_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_bookmarks', function(table) {
    table.bigIncrements('id');
    table.bigInteger('job_id').unsigned().notNullable();
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.foreign('job_id').references('id').inTable('jobs');
    table.foreign('candidate_id').references('id').inTable('candidates');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_bookmarks');
};
