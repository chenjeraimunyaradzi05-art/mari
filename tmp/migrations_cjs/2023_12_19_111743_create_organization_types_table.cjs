// Auto-generated from 2023_12_19_111743_create_organization_types_table.php
exports.up = function(knex) {
  return knex.schema.createTable('organization_types', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('slug').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('organization_types');
};
