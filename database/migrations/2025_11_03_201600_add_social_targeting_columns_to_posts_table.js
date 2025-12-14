// Auto-generated from 2025_11_03_201600_add_social_targeting_columns_to_posts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('posts', 'author_type');
  const __has_col_up_1 = await knex.schema.hasColumn('posts', 'tags');
  const __has_col_up_2 = await knex.schema.hasColumn('posts', 'audience_sector');
  const __has_col_up_3 = await knex.schema.hasColumn('posts', 'audience_skills');
  const __has_col_up_4 = await knex.schema.hasColumn('posts', 'metadata');
  const __has_col_up_5 = await knex.schema.hasColumn('posts', 'match_insights');
  const cols = ['author_type','tags','audience_sector','audience_skills','metadata','match_insights'];
  const originalHas = {};
  for (const c of cols) originalHas[c] = await knex.schema.hasColumn('posts', c);
  if (!await knex.schema.hasTable('posts')) return;

  if (!__has_col_up_0) {
    await knex.schema.alterTable('posts', (table) => {
      table.enu('author_type', ['candidate', 'company']).notNullable().defaultTo('candidate');
    });
  }

  if (!__has_col_up_1) {
    await knex.schema.alterTable('posts', (table) => {
      table.string('tags').nullable();
    });
  }

  if (!__has_col_up_2) {
    await knex.schema.alterTable('posts', (table) => {
      table.string('audience_sector', 120).nullable();
    });
  }

  if (!__has_col_up_3) {
    await knex.schema.alterTable('posts', (table) => {
      table.json('audience_skills').nullable();
    });
  }

  if (!__has_col_up_4) {
    await knex.schema.alterTable('posts', (table) => {
      table.json('metadata').nullable();
    });
  }

  if (!__has_col_up_5) {
    await knex.schema.alterTable('posts', (table) => {
      table.json('match_insights').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (!await knex.schema.hasTable('posts')) return;
  const cols = ['match_insights', 'metadata', 'audience_skills', 'audience_sector', 'tags', 'author_type'];
  for (const col of cols) {
    if (!originalHas[col]) {
      await knex.schema.alterTable('posts', table => { table.dropColumn(col); });
    }
  }
};
