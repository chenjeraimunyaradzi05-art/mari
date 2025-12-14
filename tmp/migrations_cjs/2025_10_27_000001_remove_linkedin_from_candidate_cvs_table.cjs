// Auto-generated from 2025_10_27_000001_remove_linkedin_from_candidate_cvs_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('candidate_cvs'))) return;
  const hasLinkedin = await knex.schema.hasColumn('candidate_cvs', 'linkedin');
  if (hasLinkedin) {
    await knex.schema.alterTable('candidate_cvs', (table) => {
      table.dropColumn('linkedin');
    });
  }
};

exports.down = async function(knex) {
  if (!(await knex.schema.hasTable('candidate_cvs'))) return;
  const hasLinkedin = await knex.schema.hasColumn('candidate_cvs', 'linkedin');
  if (!hasLinkedin) {
    await knex.schema.alterTable('candidate_cvs', (table) => {
      table.string('linkedin').nullable().after('website');
    });
  }
};
