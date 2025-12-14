// Auto-generated from 2025_10_27_120000_create_candidate_resume_snapshots_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('candidate_resume_snapshots')) return;
  await knex.schema.createTable('candidate_resume_snapshots', (table) => {
    table.bigIncrements('id');
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.bigInteger('candidate_cv_id').unsigned().nullable();
    table.string('source').nullable();
    table.decimal('profile_score', 5, 2).nullable();
    table.decimal('ats_score', 5, 2).nullable();
    table.decimal('skill_coverage', 5, 2).nullable();
    table.decimal('experience_alignment', 5, 2).nullable();
    table.json('skills').nullable();
    table.json('education').nullable();
    table.json('experience').nullable();
    table.json('insights').nullable();
    table.json('metadata').nullable();
    table.string('resume_hash').nullable();
    table.timestamps(true, true);

    table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
    table.foreign('candidate_cv_id').references('id').inTable('candidate_cvs').onDelete('SET NULL');
    table.index(['candidate_id', 'created_at']);
    table.index(['candidate_cv_id', 'created_at']);
    table.index('resume_hash');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('candidate_resume_snapshots');
};
