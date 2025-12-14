// Auto-generated from 2014_10_12_100000_create_password_reset_tokens_table.php
exports.up = function(knex) {
  return knex.schema.createTable('password_reset_tokens', function(table) {
    table.string('email').primary();
    table.string('token');
    table.timestamp('created_at').nullable();
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('password_reset_tokens');
};
