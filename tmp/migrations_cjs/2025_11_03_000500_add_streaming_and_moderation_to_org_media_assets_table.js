// Auto-generated from 2025_11_03_000500_add_streaming_and_moderation_to_org_media_assets_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('org_media_assets', 'hls_playlist_path');
  const __has_col_up_1 = await knex.schema.hasColumn('org_media_assets', 'stream_variants');
  const __has_col_up_2 = await knex.schema.hasColumn('org_media_assets', 'moderation_labels');
  const __has_col_up_3 = await knex.schema.hasColumn('org_media_assets', 'moderation_status');
  const __has_col_up_4 = await knex.schema.hasColumn('org_media_assets', 'moderation_summary');

  const __has_col_up_0 = __has_col_up_0;
  const __has_col_up_1 = __has_col_up_1;
  const __has_col_up_2 = __has_col_up_2;
  const __has_col_up_3 = __has_col_up_3;
  const __has_col_up_4 = __has_col_up_4;

  if (!await knex.schema.hasTable('org_media_assets')) return;

  if (!__has_col_up_0) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.string('hls_playlist_path').nullable();
    });
  }

  if (!__has_col_up_1) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.json('stream_variants').nullable();
    });
  }

  if (!__has_col_up_2) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.json('moderation_labels').nullable();
    });
  }

  if (!__has_col_up_3) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.string('moderation_status', 32).nullable().defaultTo('pending');
      table.index('moderation_status', 'org_media_assets_moderation_status_idx');
    });
  }

  if (!__has_col_up_4) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.text('moderation_summary').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (!await knex.schema.hasTable('org_media_assets')) return;

  if (__has_col_up_4) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('moderation_summary'); });
  }

  if (__has_col_up_3) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropIndex('moderation_status', 'org_media_assets_moderation_status_idx'); table.dropColumn('moderation_status'); });
  }

  if (__has_col_up_2) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('moderation_labels'); });
  }

  if (__has_col_up_1) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('stream_variants'); });
  }

  if (__has_col_up_0) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('hls_playlist_path'); });
  }
};
