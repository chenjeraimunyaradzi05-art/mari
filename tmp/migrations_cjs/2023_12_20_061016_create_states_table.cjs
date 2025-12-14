// Auto-generated from 2023_12_20_061016_create_states_table.php
exports.up = function(knex) {
  return knex.schema.createTable('states', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.bigInteger('country_id').unsigned().notNullable();
    table.foreign('country_id').references('id').inTable('countries').onDelete('CASCADE');
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('states');
};
