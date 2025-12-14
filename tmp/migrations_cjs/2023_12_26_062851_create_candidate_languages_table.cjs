// Auto-generated from 2023_12_26_062851_create_candidate_languages_table.php
exports.up = function(knex) {
  return knex.schema.createTable('candidate_languages', function(table) {
    table.bigIncrements('id');
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.bigInteger('language_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
    table.foreign('language_id').references('id').inTable('languages');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('candidate_languages');
};
