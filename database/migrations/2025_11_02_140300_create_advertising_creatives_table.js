// Auto-generated from 2025_11_02_140300_create_advertising_creatives_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('advertising_creatives')) return;
  await knex.schema.createTable('advertising_creatives', (table) => {
    table.bigIncrements('id');
    table.bigInteger('company_id').unsigned().notNullable();
    table.bigInteger('campaign_id').unsigned().notNullable();
    table.string('name', 150).notNullable();
    table.string('format', 40).notNullable();
    table.string('status', 40).notNullable().defaultTo('draft');
    table.string('review_status', 40).notNullable().defaultTo('pending');
    table.string('headline', 150).nullable();
    table.text('primary_text').nullable();
    table.string('cta_label', 60).nullable();
    table.string('destination_url', 2048).nullable();
    table.string('preview_image_url', 2048).nullable();
    table.string('preview_video_url', 2048).nullable();
    table.json('insights').nullable();
    table.text('notes').nullable();
    table.timestamps(true, true);
    table.timestamp('deleted_at').nullable();

    table.index(['campaign_id', 'status'], 'adv_creatives_campaign_status_idx');
    table.index(['company_id', 'format'], 'adv_creatives_company_format_idx');
    table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    table.foreign('campaign_id').references('id').inTable('advertising_campaigns').onDelete('CASCADE');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('advertising_creatives');
};
