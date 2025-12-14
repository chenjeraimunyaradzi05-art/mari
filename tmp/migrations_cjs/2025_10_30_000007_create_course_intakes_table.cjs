
// Ported from 2025_10_30_000007_create_course_intakes_table.php
exports.up = function(knex) {
  return knex.schema.createTable('course_intakes', function(table) {
    table.increments('id').primary();
    table.integer('course_id').unsigned().references('id').inTable('courses').onDelete('CASCADE');
    table.date('start_on');
    table.date('apply_by').nullable();
    table.integer('seats').unsigned().nullable();
    table.json('scholarships').nullable();
    table.timestamps(true, true);
    table.index(['course_id','start_on']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('course_intakes');
};
