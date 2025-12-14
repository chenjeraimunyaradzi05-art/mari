// Auto-generated from 2025_10_26_000000_create_warmup_metric_events_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('warmup_metric_events'))) {
    await knex.schema.createTable('warmup_metric_events', (table) => {
      table.bigIncrements('id');
      table.bigInteger('job_id').unsigned().nullable();
      table.bigInteger('candidate_id').unsigned().nullable();
      table.string('warmable_type').nullable();
      table.bigInteger('warmable_id').unsigned().nullable();
      table.string('action').notNullable().defaultTo('warm_job_matches');
      table.string('status').notNullable().defaultTo('success');
      table.integer('duration_ms').unsigned().nullable();
      table.smallint('attempts').unsigned().notNullable().defaultTo(1);
      table.timestamp('started_at').nullable();
      table.timestamp('finished_at').nullable();
      table.json('context').nullable();
      table.text('error_message').nullable();
      table.timestamps(true, true);

      table.foreign('job_id').references('id').inTable('jobs').onDelete('CASCADE');
      table.foreign('candidate_id').references('id').inTable('candidates').onDelete('CASCADE');
      table.index(['warmable_type', 'warmable_id'], 'warmup_metric_events_warmable_index');
      table.index(['status', 'created_at'], 'warmup_metric_events_status_created_index');
      table.index(['job_id', 'candidate_id'], 'warmup_metric_events_job_candidate_index');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('warmup_metric_events');
};
