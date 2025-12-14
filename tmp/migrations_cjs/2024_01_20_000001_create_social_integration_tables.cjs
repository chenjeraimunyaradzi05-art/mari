// Auto-generated from 2024_01_20_000001_create_social_integration_tables.php
exports.up = async function(knex) {
  // Create job_shares table
  const exists = await knex.schema.hasTable('job_shares');
  if (!exists) {
    await knex.schema.createTable('job_shares', function(table) {
      table.bigIncrements('id');
      table.bigInteger('job_id').unsigned().notNullable();
      table.bigInteger('user_id').unsigned().nullable();
      table.string('platform');
      table.string('ip_address').nullable();
      table.string('user_agent').nullable();
      table.timestamp('shared_at').notNullable();
      table.timestamps(true, true);
      table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE');
      table.foreign('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.index(['job_id', 'platform']);
      table.index('shared_at');
    });
  }

  // Add provider columns to candidates, if missing
  if (!await knex.schema.hasColumn('candidates', 'provider')) {
    await knex.schema.alterTable('candidates', function(table) {
      table.string('provider').nullable();
      table.string('provider_id').nullable();
      table.text('provider_token').nullable();
      table.index(['provider', 'provider_id']);
    });
  }

  // Add provider columns to companies, if missing
  if (!await knex.schema.hasColumn('companies', 'provider')) {
    await knex.schema.alterTable('companies', function(table) {
      table.string('provider').nullable();
      table.string('provider_id').nullable();
      table.text('provider_token').nullable();
      table.index(['provider', 'provider_id']);
    });
  }
};

exports.down = async function(knex) {
  // Drop job_shares
  if (await knex.schema.hasTable('job_shares')) {
    await knex.schema.dropTable('job_shares');
  }

  // Drop provider columns from candidates
  if (await knex.schema.hasColumn('candidates', 'provider')) {
    await knex.schema.alterTable('candidates', function(table) {
      table.dropColumn('provider');
      table.dropColumn('provider_id');
      table.dropColumn('provider_token');
    });
  }

  // Drop provider columns from companies
  if (await knex.schema.hasColumn('companies', 'provider')) {
    await knex.schema.alterTable('companies', function(table) {
      table.dropColumn('provider');
      table.dropColumn('provider_id');
      table.dropColumn('provider_token');
    });
  }
};
