// Auto-generated from 2024_01_26_create_driver_license_types_table.php
exports.up = function(knex) {
  return knex.schema.createTable('driver_license_types', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('code');
    table.text('description').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('driver_license_types');
};
