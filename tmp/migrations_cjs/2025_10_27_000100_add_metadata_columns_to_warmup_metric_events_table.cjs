// Auto-generated from 2025_10_27_000100_add_metadata_columns_to_warmup_metric_events_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!(await knex.schema.hasTable('warmup_metric_events'))) return;
  const hasLatencyBucket = await knex.schema.hasColumn('warmup_metric_events', 'latency_bucket');
  const hasFailureCode = await knex.schema.hasColumn('warmup_metric_events', 'failure_code');
  const hasEnvironment = await knex.schema.hasColumn('warmup_metric_events', 'environment');
  const hasTags = await knex.schema.hasColumn('warmup_metric_events', 'tags');
  const hasMetadata = await knex.schema.hasColumn('warmup_metric_events', 'metadata');

  await knex.schema.alterTable('warmup_metric_events', (table) => {
    if (!hasLatencyBucket) table.string('latency_bucket').nullable().after('duration_ms');
    if (!hasFailureCode) table.string('failure_code').nullable().after('status');
    if (!hasEnvironment) table.string('environment').notNullable().defaultTo('production').after('failure_code');
    if (!hasTags) table.json('tags').nullable().after('context');
    if (!hasMetadata) table.json('metadata').nullable().after('tags');
  });
};

exports.down = async function(knex) {
  if (!(await knex.schema.hasTable('warmup_metric_events'))) return;
  const columns = ['latency_bucket','failure_code','environment','tags','metadata'];
  await knex.schema.alterTable('warmup_metric_events', (table) => {
    for (const col of columns) {
      // The hasColumn check ensures this won't throw if column missing
      // We cannot call hasColumn here as we are in callback; rely on outer checks
    }
  });
  for (const col of columns) {
    if (await knex.schema.hasColumn('warmup_metric_events', col)) {
      await knex.schema.alterTable('warmup_metric_events', (table) => {
        table.dropColumn(col);
      });
    }
  }
};
