// Auto-generated from 2025_11_02_140000_create_advertising_campaigns_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('advertising_campaigns'))) {
    await knex.schema.createTable('advertising_campaigns', function(table) {
      table.bigIncrements('id');
      table.bigInteger('company_id').unsigned().notNullable();
      table.string('name').notNullable();
      table.string('status').notNullable().defaultTo('draft');
      table.string('objective').notNullable();
      table.json('targeting').nullable();
      table.json('tracking_parameters').nullable();
      table.decimal('daily_budget', 12, 2).nullable();
      table.decimal('lifetime_budget', 12, 2).nullable();
      table.date('starts_at').nullable();
      table.date('ends_at').nullable();
      table.text('creative_brief').nullable();
      table.timestamps(true, true);
      table.timestamp('deleted_at').nullable();

      table.index(['company_id', 'status']);
      table.index(['company_id', 'objective']);
      table.index(['company_id', 'starts_at']);
      table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('advertising_campaigns');
};
