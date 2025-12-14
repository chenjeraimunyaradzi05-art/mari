// Auto-generated from 2023_12_11_093917_create_admins_table.php
exports.up = function(knex) {
  return knex.schema.createTable('admins', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('image').defaultTo('/images/default-avatar.png');
    table.string('email').unique();
    table.timestamp('email_verified_at').nullable();
    table.string('password');
    table.string('remember_token', 100).nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('admins');
};
