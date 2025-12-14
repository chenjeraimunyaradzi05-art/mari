// Auto-generated from 2023_12_20_061027_create_cities_table.php
exports.up = function(knex) {
  return knex.schema.createTable('cities', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.bigInteger('state_id').unsigned().notNullable();
    table.bigInteger('country_id').unsigned().notNullable();
    table.foreign('state_id').references('id').inTable('states');
    table.foreign('country_id').references('id').inTable('countries');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('cities');
};
