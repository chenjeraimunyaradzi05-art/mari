// Auto-generated from 2025_10_24_101949_create_skill_gap_analysis_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('skill_gap_analysis_tables');
  if (exists) return;
  await knex.schema.createTable('skill_gap_analysis_tables', (table) => {
    table.bigIncrements('id');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('skill_gap_analysis_tables');
};
