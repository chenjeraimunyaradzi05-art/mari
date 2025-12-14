// Auto-generated from 2024_01_28_110347_create_job_locations_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_locations', function(table) {
    table.bigIncrements('id');
    table.string('image');
    table.bigInteger('country_id').unsigned().notNullable();
    table.enu('status', ['featured', 'trending', 'hot']).nullable();
    table.timestamps(true, true);
    table.foreign('country_id').references('id').inTable('countries');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_locations');
};
