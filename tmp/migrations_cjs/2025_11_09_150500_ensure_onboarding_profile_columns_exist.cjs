// Auto-generated from 2025_11_09_150500_ensure_onboarding_profile_columns_exist.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!await knex.schema.hasTable('users')) return;

  if (!await knex.schema.hasColumn('users', 'preferred_name')) {
    await knex.schema.alterTable('users', (table) => { table.string('preferred_name', 191).nullable(); });
  }

  if (!await knex.schema.hasColumn('users', 'pronouns')) {
    await knex.schema.alterTable('users', (table) => { table.string('pronouns', 50).nullable(); });
  }

  if (!await knex.schema.hasColumn('users', 'timezone')) {
    await knex.schema.alterTable('users', (table) => { table.string('timezone', 64).notNullable().defaultTo('UTC'); });
  }

  if (!await knex.schema.hasColumn('users', 'onboarding_step')) {
    await knex.schema.alterTable('users', (table) => { table.string('onboarding_step', 64).nullable(); });
  }

  if (!await knex.schema.hasColumn('users', 'persona_flags')) {
    await knex.schema.alterTable('users', (table) => { table.json('persona_flags').nullable(); });
  }

  // Set null timezone rows to UTC
  if (await knex.schema.hasColumn('users', 'timezone')) {
    await knex('users').whereNull('timezone').update({ timezone: 'UTC' });
  }
};

exports.down = async function(knex) {
  // No-op down rollback: columns are considered required
};
