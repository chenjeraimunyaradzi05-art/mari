// Auto-generated from 2025_10_29_000001_create_job_recommendation_audits_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('job_recommendation_audits')) {
    return;
  }

  await knex.schema.createTable('job_recommendation_audits', (table) => {
    table.bigIncrements('id');
    table.bigInteger('candidate_id').unsigned().notNullable();
    table.smallint('match_total').unsigned().notNullable().defaultTo(0);
    table.decimal('employer_diversity', 5, 4).notNullable().defaultTo(0);
    table.decimal('role_diversity', 5, 4).notNullable().defaultTo(0);
    table.decimal('location_diversity', 5, 4).notNullable().defaultTo(0);
    table.decimal('average_score', 5, 2).notNullable().defaultTo(0);
    table.decimal('score_variance', 7, 4).notNullable().defaultTo(0);
    table.json('payload').nullable();
    table.timestamp('recorded_at').notNullable();
    table.timestamps(true, true);

    table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
    table.index(['candidate_id', 'recorded_at'], 'jra_candidate_recorded_idx');
  });
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('job_recommendation_audits');
};
