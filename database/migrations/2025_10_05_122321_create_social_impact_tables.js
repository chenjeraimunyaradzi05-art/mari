// Auto-generated from 2025_10_05_122321_create_social_impact_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('social_impact_tables');
  if (exists) return;

  await knex.schema.createTable('social_impact_tables', (table) => {
    table.bigIncrements('id');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('social_impact_tables');
};
