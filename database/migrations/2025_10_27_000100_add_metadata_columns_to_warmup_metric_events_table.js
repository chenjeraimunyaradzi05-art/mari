// Auto-generated from 2025_10_27_000100_add_metadata_columns_to_warmup_metric_events_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('warmup_metric_events', 'latency_bucket');
  const __has_col_up_1 = await knex.schema.hasColumn('warmup_metric_events', 'failure_code');
  const __has_col_up_2 = await knex.schema.hasColumn('warmup_metric_events', 'environment');
  const __has_col_up_3 = await knex.schema.hasColumn('warmup_metric_events', 'tags');
  const __has_col_up_4 = await knex.schema.hasColumn('warmup_metric_events', 'metadata');
  const __has_col_up_5 = await knex.schema.hasColumn('warmup_metric_events', col);

  const __has_col_up_0 = __has_col_up_0;
  const __has_col_up_1 = __has_col_up_1;
  const __has_col_up_2 = __has_col_up_2;
  const __has_col_up_3 = __has_col_up_3;
  const __has_col_up_4 = __has_col_up_4;
  const __has_col_up_5 = __has_col_up_5;

  if (!(await knex.schema.hasTable('warmup_metric_events'))) return;
  const hasLatencyBucket = __has_col_up_0;
  const hasFailureCode = __has_col_up_1;
  const hasEnvironment = __has_col_up_2;
  const hasTags = __has_col_up_3;
  const hasMetadata = __has_col_up_4;

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
    if (__has_col_up_5) {
      await knex.schema.alterTable('warmup_metric_events', (table) => {
        table.dropColumn(col);
      });
    }
  }
};
