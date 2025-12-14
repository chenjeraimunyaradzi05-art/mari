// Auto-generated from 2025_11_11_150500_add_account_classification_to_users_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasColumn('users', 'account_classification'))) {
    await knex.schema.alterTable('users', function(table) {
      table.string('account_classification').defaultTo('candidate').after('role');
      table.index('account_classification');
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasColumn('users', 'account_classification')) {
    await knex.schema.alterTable('users', function(table) {
      table.dropIndex('account_classification');
      table.dropColumn('account_classification');
    });
  }
};
