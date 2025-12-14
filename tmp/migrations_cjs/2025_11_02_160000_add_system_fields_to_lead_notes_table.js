// Auto-generated from 2025_11_02_160000_add_system_fields_to_lead_notes_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('lead_notes', 'is_system');
  const __has_col_up_1 = await knex.schema.hasColumn('lead_notes', 'metadata');

  const __has_col_up_0 = __has_col_up_0;
  const __has_col_up_1 = __has_col_up_1;

  if (!__has_col_up_0) {
    await knex.schema.alterTable('lead_notes', function(table) {
      table.boolean('is_system').notNullable().defaultTo(false);
    });
  }
  if (!__has_col_up_1) {
    await knex.schema.alterTable('lead_notes', function(table) {
      table.json('metadata').nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasIsSystem = __has_col_up_0;
  const hasMetadata = __has_col_up_1;
  if (hasIsSystem || hasMetadata) {
    await knex.schema.alterTable('lead_notes', function(table) {
      if (hasIsSystem) table.dropColumn('is_system');
      if (hasMetadata) table.dropColumn('metadata');
    });
  }
};
