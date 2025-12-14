// Auto-generated from 2023_12_18_102543_create_industry_types_table.php
exports.up = function(knex) {
  return knex.schema.createTable('industry_types', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('industry_types');
};
