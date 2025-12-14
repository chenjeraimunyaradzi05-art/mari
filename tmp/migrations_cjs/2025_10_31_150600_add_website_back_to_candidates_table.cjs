// Auto-generated from 2025_10_31_150600_add_website_back_to_candidates_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!await knex.schema.hasColumn('candidates', 'website')) {
    await knex.schema.alterTable('candidates', function(table) {
      table.string('website').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasColumn('candidates', 'website')) {
    await knex.schema.alterTable('candidates', function(table) {
      table.dropColumn('website');
    });
  }
};
