// Auto-generated from 2025_11_02_140400_create_advertising_campaign_metrics_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('advertising_campaign_metrics')) return;
  await knex.schema.createTable('advertising_campaign_metrics', (table) => {
    table.bigIncrements('id');
    table.bigInteger('campaign_id').unsigned().notNullable();
    table.date('recorded_at').notNullable();
    table.bigInteger('impressions').unsigned().notNullable().defaultTo(0);
    table.bigInteger('clicks').unsigned().notNullable().defaultTo(0);
    table.integer('conversions').unsigned().notNullable().defaultTo(0);
    table.integer('qualified_leads').unsigned().notNullable().defaultTo(0);
    table.bigInteger('spend_cents').unsigned().notNullable().defaultTo(0);
    table.decimal('pipeline_value', 12, 2).notNullable().defaultTo(0);
    table.json('notes').nullable();
    table.timestamps(true, true);

    table.unique(['campaign_id', 'recorded_at'], 'adv_campaign_metrics_unique_day');
    table.index(['recorded_at'], 'adv_campaign_metrics_recorded_idx');
    table.index(['campaign_id', 'impressions'], 'adv_campaign_metrics_impressions_idx');
    table.foreign('campaign_id').references('id').inTable('advertising_campaigns').onDelete('CASCADE');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('advertising_campaign_metrics');
};
