// Auto-generated from 2017_08_11_073824_create_menus_wp_table.php
exports.up = function(knex) {
  return knex.schema.createTable('menus', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('menus');
};
