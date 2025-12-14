// Auto-generated from 2024_01_04_095501_create_user_plans_table.php
exports.up = function(knex) {
  return knex.schema.createTable('user_plans', function(table) {
    table.bigIncrements('id');
    table.bigInteger('company_id').unsigned().notNullable();
    table.bigInteger('plan_id').unsigned().notNullable();
    table.integer('job_limit').defaultTo(0);
    table.integer('featured_job_limit').defaultTo(0);
    table.integer('highlight_job_limit').defaultTo(0);
    table.integer('profile_verified').defaultTo(0);
    table.timestamps(true, true);
    table.foreign('company_id').references('id').inTable('companies');
    table.foreign('plan_id').references('id').inTable('plans');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('user_plans');
};
