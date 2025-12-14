// Auto-generated from 2024_01_29_064929_create_reviews_table.php
exports.up = function(knex) {
  return knex.schema.createTable('reviews', function(table) {
    table.bigIncrements('id');
    table.string('image');
    table.string('name');
    table.string('title');
    table.string('review');
    table.integer('rating');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('reviews');
};
