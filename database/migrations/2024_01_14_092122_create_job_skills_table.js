// Auto-generated from 2024_01_14_092122_create_job_skills_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_skills', function(table) {
    table.bigIncrements('id');
    table.bigInteger('job_id').unsigned().notNullable();
    table.bigInteger('skill_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE');
    table.foreign('skill_id').references('id').inTable('skills');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_skills');
};
