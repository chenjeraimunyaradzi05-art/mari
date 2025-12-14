// Auto-generated from 2019_01_05_293551_add-role-id-to-menu-items-table.php

exports.up = async function(knex) {
  // original migration adds role_id to configured menu items table; we try the common table name
  const tableName = 'menu_items';
  const __has_col_up_0 = await knex.schema.hasColumn(tableName, 'role_id');
  if (await knex.schema.hasTable(tableName)) {
    if (!(__has_col_up_0)) {
      await knex.schema.table(tableName, (table) => {
        table.integer('role_id').defaultTo(0);
      });
    }
  }
};

exports.down = async function(knex) {
  const tableName = 'menu_items';
  if (await knex.schema.hasTable(tableName) && __has_col_up_0) {
    await knex.schema.table(tableName, (table) => {
      table.dropColumn('role_id');
    });
  }
};
