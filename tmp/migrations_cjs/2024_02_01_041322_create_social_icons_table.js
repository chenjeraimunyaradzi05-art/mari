// Auto-generated from 2024_02_01_041322_create_social_icons_table.php
exports.up = function(knex) {
  return knex.schema.createTable('social_icons', function(table) {
    table.bigIncrements('id');
    table.string('icon');
    table.text('url');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('social_icons');
};
