// Auto-generated from 2023_12_27_031235_create_candidate_experiences_table.php
exports.up = function(knex) {
  return knex.schema.createTable('candidate_experiences', function(table) {
    table.bigIncrements('id');
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.string('company');
    table.string('department');
    table.string('designation');
    table.date('start');
    table.date('end');
    table.text('responsibilities').nullable();
    table.boolean('currently_working').defaultTo(false);
    table.timestamps(true, true);
    table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('candidate_experiences');
};
