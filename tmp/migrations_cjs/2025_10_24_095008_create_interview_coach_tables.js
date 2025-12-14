// Auto-generated from 2025_10_24_095008_create_interview_coach_tables.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const exists = await knex.schema.hasTable('interview_coach_tables');
  if (exists) return;

  await knex.schema.createTable('interview_coach_tables', (table) => {
    table.bigIncrements('id');
    table.timestamps(true, true);
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('interview_coach_tables');
};
