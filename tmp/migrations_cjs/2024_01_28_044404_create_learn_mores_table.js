// Auto-generated from 2024_01_28_044404_create_learn_mores_table.php
exports.up = function(knex) {
  return knex.schema.createTable('learn_mores', function(table) {
    table.bigIncrements('id');
    table.string('image');
    table.string('title');
    table.string('main_title');
    table.string('sub_title');
    table.text('url').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('learn_mores');
};
