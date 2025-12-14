// Auto-generated from 2025_10_24_122300_add_mobile_to_candidates_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('candidates', 'mobile');

  const __has_col_up_0 = __has_col_up_0;

  if (await knex.schema.hasTable('candidates')) {
    const hasMobile = __has_col_up_0;
    if (!hasMobile) {
      await knex.schema.alterTable('candidates', (table) => {
        table.string('mobile').nullable().after('phone_two');
      });
    }
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('candidates')) {
    const hasMobile = __has_col_up_0;
    if (hasMobile) {
      await knex.schema.alterTable('candidates', (table) => {
        table.dropColumn('mobile');
      });
    }
  }
};
