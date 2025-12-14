// Auto-generated from 2019_08_19_000000_create_failed_jobs_table.php
exports.up = function(knex) {
  return knex.schema.createTable('failed_jobs', function(table) {
    table.bigIncrements('id');
    table.string('uuid').unique();
    table.text('connection');
    table.text('queue');
    table.text('payload', 'longtext');
    table.text('exception', 'longtext');
    table.timestamp('failed_at').defaultTo(knex.fn.now());
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('failed_jobs');
};
