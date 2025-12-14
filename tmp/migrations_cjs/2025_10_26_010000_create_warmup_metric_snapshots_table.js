// Auto-generated from 2025_10_26_010000_create_warmup_metric_snapshots_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('warmup_metric_snapshots'))) {
    await knex.schema.createTable('warmup_metric_snapshots', (table) => {
      table.bigIncrements('id');
      table.date('snapshot_date').notNullable();
      table.string('scope').notNullable().defaultTo('global');
      table.integer('jobs_warmed').unsigned().notNullable().defaultTo(0);
      table.integer('success_count').unsigned().notNullable().defaultTo(0);
      table.integer('failure_count').unsigned().notNullable().defaultTo(0);
      table.integer('avg_duration_ms').unsigned().notNullable().defaultTo(0);
      table.integer('p95_duration_ms').unsigned().notNullable().defaultTo(0);
      table.json('stats').nullable();
      table.timestamps(true, true);

      table.unique(['snapshot_date', 'scope'], 'warmup_metric_snapshots_unique_scope');
    });
  }
};

exports.down = async function(knex) {
  await knex.schema.dropTableIfExists('warmup_metric_snapshots');
};
