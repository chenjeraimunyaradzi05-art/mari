// Auto-generated from 2024_01_09_035110_create_job_categories_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_categories', function(table) {
    table.bigIncrements('id');
    table.string('icon');
    table.string('name');
    table.string('slug');
    table.boolean('show_at_popular').defaultTo(false);
    table.boolean('show_at_featured').defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_categories');
};
