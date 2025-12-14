// Auto-generated from 2023_12_26_062857_create_candidate_skills_table.php
exports.up = function(knex) {
  return knex.schema.createTable('candidate_skills', function(table) {
    table.bigIncrements('id');
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.bigInteger('skill_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
    table.foreign('skill_id').references('id').inTable('skills');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('candidate_skills');
};
