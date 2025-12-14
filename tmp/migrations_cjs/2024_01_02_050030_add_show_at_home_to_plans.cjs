// Auto-generated from 2024_01_02_050030_add_show_at_home_to_plans.php
exports.up = function(knex) {
  return knex.schema.alterTable('plans', function(table) {
    table.boolean('show_at_home').defaultTo(false);
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('plans', function(table) {
    table.dropColumn('show_at_home');
  });
};
