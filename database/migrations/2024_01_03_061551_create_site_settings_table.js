// Auto-generated from 2024_01_03_061551_create_site_settings_table.php
exports.up = function(knex) {
  return knex.schema.createTable('site_settings', function(table) {
    table.bigIncrements('id');
    table.string('key');
    table.text('value').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('site_settings');
};
