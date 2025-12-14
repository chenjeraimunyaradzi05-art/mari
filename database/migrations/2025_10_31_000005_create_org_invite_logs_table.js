// Auto-generated from 2025_10_31_000005_create_org_invite_logs_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('org_invite_logs'))) {
    await knex.schema.createTable('org_invite_logs', (table) => {
      table.bigIncrements('id');
      table.bigInteger('org_page_id').unsigned().notNullable();
      table.string('email').notNullable();
      table.bigInteger('invited_by').unsigned().nullable();
      table.string('channel').notNullable().defaultTo('email');
      table.string('status').notNullable().defaultTo('pending');
      table.json('meta').nullable();
      table.timestamp('sent_at').nullable();
      table.timestamps(true, true);

      table.foreign('org_page_id').references('id').inTable('organization_pages').onDelete('CASCADE');
      table.foreign('invited_by').references('id').inTable('users').onDelete('SET NULL');
      table.index('status');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('org_invite_logs');
};
