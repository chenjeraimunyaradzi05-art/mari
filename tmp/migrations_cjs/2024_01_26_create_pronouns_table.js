// Auto-generated from 2024_01_26_create_pronouns_table.php
exports.up = function(knex) {
  return knex.schema.createTable('pronouns', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('display_name').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('pronouns');
};
