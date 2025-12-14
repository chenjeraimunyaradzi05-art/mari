// Auto-generated from 2025_11_06_010200_add_profile_fields_to_users.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const client = (knex.client && knex.client.config && knex.client.config.client) || '';

  if (!await knex.schema.hasColumn('users', 'onboarding_step')) {
    if (client && client.toString().startsWith('sqlite')) {
      await knex.schema.alterTable('users', (table) => { table.string('onboarding_step').notNullable().defaultTo('welcome'); });
    } else {
      await knex.schema.alterTable('users', (table) => { table.enu('onboarding_step', ['welcome', 'profile', 'roles', 'completed']).notNullable().defaultTo('welcome'); });
    }
  }

  if (!await knex.schema.hasColumn('users', 'persona_flags')) {
    await knex.schema.alterTable('users', (table) => { table.json('persona_flags').nullable(); });
  }

  if (!await knex.schema.hasColumn('users', 'pronouns')) {
    await knex.schema.alterTable('users', (table) => { table.string('pronouns').nullable(); });
  }

  if (!await knex.schema.hasColumn('users', 'preferred_name')) {
    await knex.schema.alterTable('users', (table) => { table.string('preferred_name').nullable(); });
  }

  if (!await knex.schema.hasColumn('users', 'timezone')) {
    await knex.schema.alterTable('users', (table) => { table.string('timezone').nullable(); });
  }
};

exports.down = async function(knex) {
  const cols = ['onboarding_step', 'persona_flags', 'pronouns', 'preferred_name', 'timezone'];
  for (const c of cols) {
    if (await knex.schema.hasColumn('users', c)) {
      await knex.schema.alterTable('users', (table) => { table.dropColumn(c); });
    }
  }
};
