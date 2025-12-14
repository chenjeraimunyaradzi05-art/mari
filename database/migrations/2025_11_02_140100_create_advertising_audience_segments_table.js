// Auto-generated from 2025_11_02_140100_create_advertising_audience_segments_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('advertising_audience_segments'))) {
    await knex.schema.createTable('advertising_audience_segments', (table) => {
      table.bigIncrements('id');
      table.bigInteger('company_id').unsigned().notNullable();
      table.string('name').notNullable();
      table.string('description').nullable();
      table.json('filters').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['company_id', 'name']);
      table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('advertising_audience_segments');
};
