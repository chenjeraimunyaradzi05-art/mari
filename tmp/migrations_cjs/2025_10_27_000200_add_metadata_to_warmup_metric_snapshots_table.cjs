// Auto-generated from 2025_10_27_000200_add_metadata_to_warmup_metric_snapshots_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('warmup_metric_snapshots'))) return;
  const hasFailureRate = await knex.schema.hasColumn('warmup_metric_snapshots', 'failure_rate');
  const hasP99 = await knex.schema.hasColumn('warmup_metric_snapshots', 'p99_duration_ms');
  const hasNotes = await knex.schema.hasColumn('warmup_metric_snapshots', 'notes');
  const hasMetadata = await knex.schema.hasColumn('warmup_metric_snapshots', 'metadata');
  await knex.schema.alterTable('warmup_metric_snapshots', (table) => {
    if (!hasFailureRate) table.decimal('failure_rate', 5, 2).notNullable().defaultTo(0).after('failure_count');
    if (!hasP99) table.integer('p99_duration_ms').unsigned().notNullable().defaultTo(0).after('p95_duration_ms');
    if (!hasNotes) table.text('notes').nullable().after('stats');
    if (!hasMetadata) table.json('metadata').nullable().after('notes');
  });
};

exports.down = async function(knex) {
  if (!(await knex.schema.hasTable('warmup_metric_snapshots'))) return;
  const columns = ['failure_rate','p99_duration_ms','notes','metadata'];
  for (const col of columns) {
    if (await knex.schema.hasColumn('warmup_metric_snapshots', col)) {
      await knex.schema.alterTable('warmup_metric_snapshots', (table) => {
        table.dropColumn(col);
      });
    }
  }
};
