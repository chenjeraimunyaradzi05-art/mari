// Auto-generated from 2025_11_03_000500_add_streaming_and_moderation_to_org_media_assets_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!await knex.schema.hasTable('org_media_assets')) return;

  if (!await knex.schema.hasColumn('org_media_assets', 'hls_playlist_path')) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.string('hls_playlist_path').nullable();
    });
  }

  if (!await knex.schema.hasColumn('org_media_assets', 'stream_variants')) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.json('stream_variants').nullable();
    });
  }

  if (!await knex.schema.hasColumn('org_media_assets', 'moderation_labels')) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.json('moderation_labels').nullable();
    });
  }

  if (!await knex.schema.hasColumn('org_media_assets', 'moderation_status')) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.string('moderation_status', 32).nullable().defaultTo('pending');
      table.index('moderation_status', 'org_media_assets_moderation_status_idx');
    });
  }

  if (!await knex.schema.hasColumn('org_media_assets', 'moderation_summary')) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.text('moderation_summary').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (!await knex.schema.hasTable('org_media_assets')) return;

  if (await knex.schema.hasColumn('org_media_assets', 'moderation_summary')) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('moderation_summary'); });
  }

  if (await knex.schema.hasColumn('org_media_assets', 'moderation_status')) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropIndex('moderation_status', 'org_media_assets_moderation_status_idx'); table.dropColumn('moderation_status'); });
  }

  if (await knex.schema.hasColumn('org_media_assets', 'moderation_labels')) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('moderation_labels'); });
  }

  if (await knex.schema.hasColumn('org_media_assets', 'stream_variants')) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('stream_variants'); });
  }

  if (await knex.schema.hasColumn('org_media_assets', 'hls_playlist_path')) {
    await knex.schema.alterTable('org_media_assets', function(table) { table.dropColumn('hls_playlist_path'); });
  }
};
