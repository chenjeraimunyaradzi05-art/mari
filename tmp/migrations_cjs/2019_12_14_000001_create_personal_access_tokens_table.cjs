// Auto-generated from 2019_12_14_000001_create_personal_access_tokens_table.php
exports.up = function(knex) {
  return knex.schema.createTable('personal_access_tokens', function(table) {
    table.bigIncrements('id');
    table.bigInteger('tokenable_id').unsigned();
    table.string('tokenable_type');
    table.text('name');
    table.string('token', 64).unique();
    table.text('abilities').nullable();
    table.timestamp('last_used_at').nullable();
    table.timestamp('expires_at').nullable().index();
    table.timestamps(true, true);
    table.index(['tokenable_type', 'tokenable_id']);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('personal_access_tokens');
};
