// Auto-generated from 2025_10_24_122300_add_mobile_to_candidates_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('candidates')) {
    const hasMobile = await knex.schema.hasColumn('candidates', 'mobile');
    if (!hasMobile) {
      await knex.schema.alterTable('candidates', (table) => {
        table.string('mobile').nullable().after('phone_two');
      });
    }
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('candidates')) {
    const hasMobile = await knex.schema.hasColumn('candidates', 'mobile');
    if (hasMobile) {
      await knex.schema.alterTable('candidates', (table) => {
        table.dropColumn('mobile');
      });
    }
  }
};
