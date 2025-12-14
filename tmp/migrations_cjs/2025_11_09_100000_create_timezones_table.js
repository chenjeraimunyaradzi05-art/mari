// Auto-generated from 2025_11_09_100000_create_timezones_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('timezones'))) {
    await knex.schema.createTable('timezones', (table) => {
      table.bigIncrements('id');
      table.string('name', 191).notNullable().unique();
      table.string('region', 120).nullable();
      table.string('country_code', 4).nullable();
      table.integer('offset_minutes').notNullable();
      table.boolean('is_dst').notNullable().defaultTo(false);
      table.timestamps(true, true);

      table.index(['region', 'country_code'], 'timezones_region_country_idx');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('timezones');
};
