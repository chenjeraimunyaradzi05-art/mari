// Auto-generated from 2025_10_29_000002_create_billing_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('billing_meters'))) {
    await knex.schema.createTable('billing_meters', (table) => {
      table.bigIncrements('id');
      table.bigInteger('company_id').unsigned().notNullable();
      table.string('event_type', 64).notNullable();
      table.bigInteger('job_id').unsigned().nullable();
      table.bigInteger('candidate_user_id').unsigned().nullable();
      table.bigInteger('applied_job_id').unsigned().nullable();
      table.boolean('eligible').notNullable().defaultTo(true);
      table.timestamp('occurred_at').notNullable();
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
      table.foreign('job_id').references('id').inTable('jobs').onDelete('SET NULL');
      table.foreign('candidate_user_id').references('id').inTable('users').onDelete('SET NULL');
      table.foreign('applied_job_id').references('id').inTable('applied_jobs').onDelete('SET NULL');

      table.index(['company_id', 'event_type', 'occurred_at'], 'billing_meters_company_event_idx');
      table.index(['job_id', 'candidate_user_id'], 'billing_meters_job_candidate_idx');
    });
  }

  if (!(await knex.schema.hasTable('billing_charges'))) {
    await knex.schema.createTable('billing_charges', (table) => {
      table.bigIncrements('id');
      table.bigInteger('company_id').unsigned().notNullable();
      table.bigInteger('meter_id').unsigned().nullable();
      table.string('charge_type', 40).notNullable();
      table.integer('amount_cents').notNullable().defaultTo(0);
      table.string('currency', 3).notNullable().defaultTo('AUD');
      table.string('status', 32).notNullable().defaultTo('pending');
      table.timestamp('billed_at').nullable();
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.foreign('company_id').references('id').inTable('companies').onDelete('CASCADE');
      table.foreign('meter_id').references('id').inTable('billing_meters').onDelete('SET NULL');
      table.index(['company_id', 'status'], 'billing_charges_company_status_idx');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('billing_charges');
  await knex.schema.dropTableIfExists('billing_meters');
};
