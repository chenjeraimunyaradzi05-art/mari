// Auto-generated from 2024_01_28_062423_create_counters_table.php
exports.up = function(knex) {
  return knex.schema.createTable('counters', function(table) {
    table.bigIncrements('id');
    table.integer('counter_one');
    table.string('title_one');
    table.integer('counter_two');
    table.string('title_two');
    table.integer('counter_three');
    table.string('title_three');
    table.integer('counter_four');
    table.string('title_four');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('counters');
};
