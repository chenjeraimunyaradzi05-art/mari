// Auto-generated from 2024_01_24_093258_create_heroes_table.php
exports.up = function(knex) {
  return knex.schema.createTable('heroes', function(table) {
    table.bigIncrements('id');
    table.string('image');
    table.string('background_image');
    table.string('title');
    table.string('sub_title');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('heroes');
};
