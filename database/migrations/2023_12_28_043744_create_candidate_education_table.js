// Auto-generated from 2023_12_28_043744_create_candidate_education_table.php
exports.up = function(knex) {
  return knex.schema.createTable('candidate_education', function(table) {
    table.bigIncrements('id');
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.string('level');
    table.string('degree');
    table.string('year');
    table.text('note').nullable();
    table.timestamps(true, true);
    table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('candidate_education');
};
