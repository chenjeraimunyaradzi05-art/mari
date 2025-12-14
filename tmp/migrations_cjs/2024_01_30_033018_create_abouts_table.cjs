// Auto-generated from 2024_01_30_033018_create_abouts_table.php
exports.up = function(knex) {
  return knex.schema.createTable('abouts', function(table) {
    table.bigIncrements('id');
    table.string('image');
    table.string('title');
    table.text('description');
    table.text('url').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('abouts');
};
