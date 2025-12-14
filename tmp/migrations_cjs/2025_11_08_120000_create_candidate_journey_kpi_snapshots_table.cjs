// Auto-generated from 2025_11_08_120000_create_candidate_journey_kpi_snapshots_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('candidate_journey_kpi_snapshots'))) {
    await knex.schema.createTable('candidate_journey_kpi_snapshots', (table) => {
      table.bigIncrements('id');
      table.bigInteger('candidate_id').unsigned().notNullable();
      table.date('snapshot_date').notNullable();

      table.smallint('onboarding_progress').unsigned().notNullable().defaultTo(0);
      table.smallint('profile_strength').unsigned().notNullable().defaultTo(0);
      table.smallint('engagement_score').unsigned().notNullable().defaultTo(0);
      table.smallint('support_actions_completed').unsigned().notNullable().defaultTo(0);

      table.json('milestone_flags').nullable();
      table.json('persona_alignment').nullable();
      table.json('ai_recommendation_uptake').nullable();

      table.timestamps(true, true);

      table.unique(['candidate_id', 'snapshot_date'], 'candidate_journey_snapshot_unique');
      table.index(['snapshot_date', 'onboarding_progress'], 'candidate_journey_snapshot_progress_idx');

      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('candidate_journey_kpi_snapshots');
};
