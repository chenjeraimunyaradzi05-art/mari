// Auto-generated from 2025_11_02_160000_add_system_fields_to_lead_notes_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!await knex.schema.hasColumn('lead_notes', 'is_system')) {
    await knex.schema.alterTable('lead_notes', function(table) {
      table.boolean('is_system').notNullable().defaultTo(false);
    });
  }
  if (!await knex.schema.hasColumn('lead_notes', 'metadata')) {
    await knex.schema.alterTable('lead_notes', function(table) {
      table.json('metadata').nullable();
    });
  }
};

exports.down = async function(knex) {
  const hasIsSystem = await knex.schema.hasColumn('lead_notes', 'is_system');
  const hasMetadata = await knex.schema.hasColumn('lead_notes', 'metadata');
  if (hasIsSystem || hasMetadata) {
    await knex.schema.alterTable('lead_notes', function(table) {
      if (hasIsSystem) table.dropColumn('is_system');
      if (hasMetadata) table.dropColumn('metadata');
    });
  }
};
