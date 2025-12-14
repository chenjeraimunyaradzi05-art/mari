// Auto-generated from 2025_10_23_103602_create_apprenticeships_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('apprenticeships_tables');
  if (exists) return;

  await knex.schema.createTable('apprenticeships_tables', (table) => {
    table.bigIncrements('id');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('apprenticeships_tables');
};
