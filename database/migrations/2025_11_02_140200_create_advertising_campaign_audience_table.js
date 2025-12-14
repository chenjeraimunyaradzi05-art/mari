// Auto-generated from 2025_11_02_140200_create_advertising_campaign_audience_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('advertising_campaign_audience'))) {
    await knex.schema.createTable('advertising_campaign_audience', (table) => {
      table.bigIncrements('id');
      table.bigInteger('campaign_id').unsigned().notNullable();
      table.bigInteger('segment_id').unsigned().notNullable();
      table.json('constraints').nullable();
      table.timestamps(true, true);

      table.unique(['campaign_id', 'segment_id']);
      table.foreign('campaign_id').references('id').inTable('advertising_campaigns').onDelete('CASCADE');
      table.foreign('segment_id').references('id').inTable('advertising_audience_segments').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('advertising_campaign_audience');
};
