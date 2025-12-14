// Auto-generated from 2025_11_09_160100_create_vertical_insights_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('vertical_insights'))) {
    await knex.schema.createTable('vertical_insights', (table) => {
      table.bigIncrements('id');
      table.string('vertical_slug').notNullable().unique();
      table.string('vertical_name').notNullable();
      table.integer('open_roles').unsigned().notNullable().defaultTo(0);
      table.integer('courses').unsigned().notNullable().defaultTo(0);
      table.integer('mentors').unsigned().notNullable().defaultTo(0);
      table.json('meta').nullable();
      table.timestamp('refreshed_at').nullable();
      table.timestamps(true, true);
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('vertical_insights');
};
