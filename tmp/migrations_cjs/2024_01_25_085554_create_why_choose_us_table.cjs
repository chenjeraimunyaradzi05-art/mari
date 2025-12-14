// Auto-generated from 2024_01_25_085554_create_why_choose_us_table.php
exports.up = function(knex) {
  return knex.schema.createTable('why_choose_us', function(table) {
    table.bigIncrements('id');
    table.string('icon_one').nullable();
    table.string('title_one').nullable();
    table.string('sub_title_one').nullable();
    table.string('icon_two').nullable();
    table.string('title_two').nullable();
    table.string('sub_title_two').nullable();
    table.string('icon_three').nullable();
    table.string('title_three').nullable();
    table.string('sub_title_three').nullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('why_choose_us');
};
