// Auto-generated from 2025_11_09_160200_create_creator_payouts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('creator_payouts'))) {
    await knex.schema.createTable('creator_payouts', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.date('period_start').notNullable();
      table.date('period_end').notNullable();
      table.bigInteger('impressions').unsigned().notNullable().defaultTo(0);
      table.decimal('payout_amount', 10, 2).notNullable().defaultTo(0);
      table.decimal('cpm', 8, 2).nullable();
      table.string('currency', 3).notNullable().defaultTo('AUD');
      table.string('status', 30).notNullable().defaultTo('pending');
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.unique(['user_id', 'period_start', 'period_end']);
      table.index('status');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('creator_payouts');
};
