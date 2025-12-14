// Auto-generated from 2024_01_14_063326_create_job_tags_table.php
exports.up = function(knex) {
  return knex.schema.createTable('job_tags', function(table) {
    table.bigIncrements('id');
    table.bigInteger('job_id').unsigned().notNullable();
    table.bigInteger('tag_id').unsigned().notNullable();
    table.timestamps(true, true);
    table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE');
    table.foreign('tag_id').references('id').inTable('tags');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('job_tags');
};
