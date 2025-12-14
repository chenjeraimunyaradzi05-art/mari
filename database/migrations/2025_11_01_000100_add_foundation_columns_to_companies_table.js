// Auto-generated from 2025_11_01_000100_add_foundation_columns_to_companies_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('companies', 'foundation_status');
  const cols = ['foundation_summary','foundation_focus_areas','foundation_programs','foundation_impact_metrics','foundation_contact_name','foundation_contact_email','foundation_contact_phone','foundation_donation_url','foundation_video_url','foundation_cta_label','foundation_cta_url','foundation_launched_at','foundation_social_links'];
  const originalHas = {};
  for (const c of cols) originalHas[c] = await knex.schema.hasColumn('companies', c);

  if (!__has_col_up_0) {
    await knex.schema.alterTable('companies', function(table) {
      table.string('foundation_status', 50).notNullable().defaultTo('inactive');
    });
    await knex.schema.alterTable('companies', function(table) {
      table.index('foundation_status', 'companies_foundation_status_index');
    });
  }

  const addIf = async (colPipe) => {
    const [col, cb] = colPipe;
    if (!originalHas[col]) {
      await knex.schema.alterTable('companies', cb);
    }
  };

  await addIf(['foundation_summary', (table) => table.text('foundation_summary').nullable()]);
  await addIf(['foundation_focus_areas', (table) => table.json('foundation_focus_areas').nullable()]);
  await addIf(['foundation_programs', (table) => table.json('foundation_programs').nullable()]);
  await addIf(['foundation_impact_metrics', (table) => table.json('foundation_impact_metrics').nullable()]);
  await addIf(['foundation_contact_name', (table) => table.string('foundation_contact_name').nullable()]);
  await addIf(['foundation_contact_email', (table) => table.string('foundation_contact_email').nullable()]);
  await addIf(['foundation_contact_phone', (table) => table.string('foundation_contact_phone', 50).nullable()]);
  await addIf(['foundation_donation_url', (table) => table.string('foundation_donation_url').nullable()]);
  await addIf(['foundation_video_url', (table) => table.string('foundation_video_url').nullable()]);
  await addIf(['foundation_cta_label', (table) => table.string('foundation_cta_label').nullable()]);
  await addIf(['foundation_cta_url', (table) => table.string('foundation_cta_url').nullable()]);
  await addIf(['foundation_launched_at', (table) => table.timestamp('foundation_launched_at').nullable()]);
  await addIf(['foundation_social_links', (table) => table.json('foundation_social_links').nullable()]);
};

exports.down = async function(knex) {
  const maybeDrop = async (col) => {
    if (!originalHas[col]) {
      await knex.schema.alterTable('companies', function(table) {
        table.dropColumn(col);
      });
    }
  };

  await maybeDrop('foundation_social_links');
  await maybeDrop('foundation_launched_at');
  await maybeDrop('foundation_cta_url');
  await maybeDrop('foundation_cta_label');
  await maybeDrop('foundation_video_url');
  await maybeDrop('foundation_donation_url');
  await maybeDrop('foundation_contact_phone');
  await maybeDrop('foundation_contact_email');
  await maybeDrop('foundation_contact_name');
  await maybeDrop('foundation_impact_metrics');
  await maybeDrop('foundation_programs');
  await maybeDrop('foundation_focus_areas');
  await maybeDrop('foundation_summary');

  if (__has_col_up_0) {
    await knex.schema.alterTable('companies', function(table) {
      table.dropIndex(['foundation_status'], 'companies_foundation_status_index');
      table.dropColumn('foundation_status');
    });
  }
};
