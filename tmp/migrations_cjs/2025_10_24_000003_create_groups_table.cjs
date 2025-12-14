// Auto-generated from 2025_10_24_000003_create_groups_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('groups'))) {
    await knex.schema.createTable('groups', (table) => {
      table.bigIncrements('id');
      table.string('name').notNullable();
      table.text('description').nullable();
      table.string('type').nullable();
      table.bigInteger('created_by').unsigned().notNullable();
      table.string('visibility').notNullable().defaultTo('public');
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('groups');
};
