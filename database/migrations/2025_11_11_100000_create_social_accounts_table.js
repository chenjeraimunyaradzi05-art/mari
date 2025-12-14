// Auto-generated from 2025_11_11_100000_create_social_accounts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('social_accounts'))) {
    await knex.schema.createTable('social_accounts', (table) => {
      table.bigIncrements('id');
      table.bigInteger('user_id').unsigned().notNullable();
      table.string('provider', 64).notNullable();
      table.string('provider_id').notNullable();
      table.string('email').nullable();
      table.string('name').nullable();
      table.string('nickname').nullable();
      table.string('avatar').nullable();
      table.text('token').nullable();
      table.text('refresh_token').nullable();
      table.timestamp('token_expires_at').nullable();
      table.json('raw').nullable();
      table.timestamps(true, true);

      table.unique(['provider', 'provider_id']);
      table.index('email');
      table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_accounts');
};
