// Auto-generated from 2024_01_01_091246_create_plans_table.php
exports.up = function(knex) {
  return knex.schema.createTable('plans', function(table) {
    table.bigIncrements('id');
    table.string('label');
    table.double('price');
    table.integer('job_limit');
    table.integer('featured_job_limit');
    table.integer('highlight_job_limit');
    table.boolean('profile_verified').defaultTo(false);
    table.boolean('recommended').defaultTo(false);
    table.boolean('frontend_show').defaultTo(false);
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('plans');
};
