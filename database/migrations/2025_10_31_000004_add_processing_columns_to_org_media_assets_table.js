// Auto-generated from 2025_10_31_000004_add_processing_columns_to_org_media_assets_table.php
// TODO: Port migration logic from PHP to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('org_media_assets', 'uploaded_by');
  const __has_col_up_2 = await knex.schema.hasColumn('org_media_assets', 'meta');
  const __has_col_up_3 = await knex.schema.hasColumn('org_media_assets', 'status');
  const __has_col_up_4 = await knex.schema.hasColumn('org_media_assets', 'transcoded_at');
  const __has_col_up_5 = await knex.schema.hasColumn('org_media_assets', 'processing_errors');

  const originalHas = {};
  const checkCols = ['disk','original_filename','processed_path','thumbnail_path','captions_path','meta','status','transcoded_at','processing_errors'];
  for (const c of checkCols) originalHas[c] = await knex.schema.hasColumn('org_media_assets', c);
  // Add columns to org_media_assets table if they do not exist
  const hasUploadedBy = __has_col_up_0;
  if (!hasUploadedBy) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.integer('uploaded_by').unsigned().nullable().after('org_page_id');
      table.foreign('uploaded_by').references('users.id').onDelete('SET NULL');
    });
  }

  const addStringColumn = async (col, after, opts = {}) => {
    if (!originalHas[col]) {
      await knex.schema.alterTable('org_media_assets', function(table) {
        let t = table.string(col);
        if (opts.default) t.defaultTo(opts.default);
        if (opts.nullable) t.nullable();
        if (after && table.after) t.after(after);
      });
    }
  };
  await addStringColumn('disk', 'type', { default: 'org_media' });
  await addStringColumn('original_filename', 'disk', { nullable: true });
  await addStringColumn('processed_path', 'storage_path', { nullable: true });
  await addStringColumn('thumbnail_path', 'processed_path', { nullable: true });
  await addStringColumn('captions_path', 'thumbnail_path', { nullable: true });

  if (!__has_col_up_2) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.json('meta').nullable().after('safety_labels');
    });
  }

  if (!__has_col_up_3) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.enu('status', ['uploaded','processing','ready','failed']).defaultTo('uploaded').after('meta').index();
    });
  }

  if (!__has_col_up_4) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.timestamp('transcoded_at').nullable().after('status');
    });
  }

  if (!__has_col_up_5) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.text('processing_errors').nullable().after('transcoded_at');
    });
  }
};

exports.down = async function(knex) {
  // Drop columns if they exist
  const dropIfExists = async (col, dropFn) => {
    if (!originalHas[col]) {
      await knex.schema.alterTable('org_media_assets', function(table) {
        dropFn(table, col);
      });
    }
  };

  // Drop foreign key and column for uploaded_by
  if (__has_col_up_0) {
    await knex.schema.alterTable('org_media_assets', function(table) {
      table.dropForeign('uploaded_by');
      table.dropColumn('uploaded_by');
    });
  }

  const columns = [
    'disk',
    'original_filename',
    'processed_path',
    'thumbnail_path',
    'captions_path',
    'meta',
    'status',
    'transcoded_at',
    'processing_errors',
  ];
  for (const col of columns) {
    await dropIfExists(col, (table, c) => table.dropColumn(c));
  }
};
