// Auto-generated from 2024_02_05_102755_create_permission_tables.php
exports.up = async function(knex) {
  // Basic permission tables used by spatie/laravel-permission
  await knex.schema.createTable('permissions', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('guard_name');
    table.string('group');
    table.timestamps(true, true);
    table.unique(['name', 'guard_name']);
  });

  await knex.schema.createTable('roles', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('guard_name');
    table.timestamps(true, true);
    table.unique(['name', 'guard_name']);
  });

  await knex.schema.createTable('model_has_permissions', function(table) {
    table.bigInteger('permission_id').unsigned();
    table.string('model_type');
    table.bigInteger('model_id').unsigned();
    table.index(['model_id', 'model_type']);
    table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
    table.primary(['permission_id', 'model_id', 'model_type']);
  });

  await knex.schema.createTable('model_has_roles', function(table) {
    table.bigInteger('role_id').unsigned();
    table.string('model_type');
    table.bigInteger('model_id').unsigned();
    table.index(['model_id', 'model_type']);
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    table.primary(['role_id', 'model_id', 'model_type']);
  });

  await knex.schema.createTable('role_has_permissions', function(table) {
    table.bigInteger('permission_id').unsigned();
    table.bigInteger('role_id').unsigned();
    table.foreign('permission_id').references('id').inTable('permissions').onDelete('CASCADE');
    table.foreign('role_id').references('id').inTable('roles').onDelete('CASCADE');
    table.primary(['permission_id', 'role_id']);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('role_has_permissions');
  await knex.schema.dropTableIfExists('model_has_roles');
  await knex.schema.dropTableIfExists('model_has_permissions');
  await knex.schema.dropTableIfExists('roles');
  await knex.schema.dropTableIfExists('permissions');
};
