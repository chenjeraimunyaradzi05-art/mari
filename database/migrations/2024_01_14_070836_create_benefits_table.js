// Auto-generated from 2024_01_14_070836_create_benefits_table.php
exports.up = function(knex) {
  return knex.schema.createTable('benefits', function(table) {
    table.bigIncrements('id');
    table.bigInteger('company_id').unsigned().notNullable();
    table.string('name');
    table.timestamps(true, true);
    table.foreign('company_id').references('id').inTable('companies');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('benefits');
};
