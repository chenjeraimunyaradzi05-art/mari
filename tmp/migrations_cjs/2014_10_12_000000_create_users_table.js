// Auto-generated from 2014_10_12_000000_create_users_table.php
exports.up = function(knex) {
  return knex.schema.createTable('users', function(table) {
    table.bigIncrements('id');
    table.string('name');
    table.string('image').defaultTo('/images/default-avatar.png');
    table.string('email').unique();
    table.timestamp('email_verified_at').nullable();
    table.enu('role', ['company', 'candidate']).defaultTo('candidate');
    table.string('password');
    table.string('remember_token', 100).nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('users');
};
