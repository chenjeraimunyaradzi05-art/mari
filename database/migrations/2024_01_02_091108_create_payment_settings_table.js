// Auto-generated from 2024_01_02_091108_create_payment_settings_table.php
exports.up = function(knex) {
  return knex.schema.createTable('payment_settings', function(table) {
    table.bigIncrements('id');
    table.string('key');
    table.text('value').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('payment_settings');
};
