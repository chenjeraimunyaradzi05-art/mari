// Auto-generated from 2017_08_11_074006_create_menu_items_wp_table.php
exports.up = function(knex) {
  return knex.schema.createTable('menu_items', function(table) {
    table.bigIncrements('id');
    table.string('label');
    table.string('link');
    table.bigInteger('parent_id').unsigned().defaultTo(0);
    table.integer('sort').defaultTo(0);
    table.string('class').nullable();
    table.bigInteger('menu_id').unsigned().notNullable();
    table.integer('depth').defaultTo(0);
    table.timestamps(true, true);
    table.foreign('menu_id').references('id').inTable('menus').onDelete('CASCADE').onUpdate('CASCADE');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTableIfExists('menu_items');
};
