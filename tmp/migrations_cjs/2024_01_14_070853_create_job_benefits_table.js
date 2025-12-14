// Auto-generated from 2024_01_14_070853_create_job_benefits_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_benefits', function(table) {
    table.bigIncrements('id');
    table.bigInteger('job_id').unsigned().notNullable();
    table.bigInteger('benefit_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE');
    table.foreign('benefit_id').references('id').inTable('benefits');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_benefits');
};
