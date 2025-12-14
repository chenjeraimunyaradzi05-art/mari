// Auto-generated from 2025_11_02_000002_create_apprenticeship_progress_records_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('apprenticeship_progress_records'))) {
    await knex.schema.createTable('apprenticeship_progress_records', function(table) {
      table.bigIncrements('id');
      table.bigInteger('apprenticeship_competency_id').unsigned().notNullable();
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.bigInteger('assessed_by').unsigned().nullable();
      table.enu('status', ['not_started', 'in_progress', 'completed', 'needs_review']).notNullable().defaultTo('not_started');
      table.integer('proficiency').unsigned().nullable();
      table.text('evidence').nullable();
      table.text('coach_notes').nullable();
      table.timestamp('started_at').nullable();
      table.timestamp('completed_at').nullable();
      table.timestamp('assessed_at').nullable();
      table.json('meta').nullable();
      table.timestamps(true, true);

      table.unique(['apprenticeship_competency_id', 'candidate_id'], 'apprenticeship_progress_unique');
      table.index(['candidate_id', 'status']);

      table.foreign('apprenticeship_competency_id', 'apr_prog_comp_fk').references('id').inTable('apprenticeship_competencies').onDelete('CASCADE');
      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.foreign('assessed_by').references('id').inTable('users').onDelete('SET NULL');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('apprenticeship_progress_records');
};
