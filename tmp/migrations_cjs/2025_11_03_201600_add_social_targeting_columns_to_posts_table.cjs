// Auto-generated from 2025_11_03_201600_add_social_targeting_columns_to_posts_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!await knex.schema.hasTable('posts')) return;

  if (!await knex.schema.hasColumn('posts', 'author_type')) {
    await knex.schema.alterTable('posts', (table) => {
      table.enu('author_type', ['candidate', 'company']).notNullable().defaultTo('candidate');
    });
  }

  if (!await knex.schema.hasColumn('posts', 'tags')) {
    await knex.schema.alterTable('posts', (table) => {
      table.string('tags').nullable();
    });
  }

  if (!await knex.schema.hasColumn('posts', 'audience_sector')) {
    await knex.schema.alterTable('posts', (table) => {
      table.string('audience_sector', 120).nullable();
    });
  }

  if (!await knex.schema.hasColumn('posts', 'audience_skills')) {
    await knex.schema.alterTable('posts', (table) => {
      table.json('audience_skills').nullable();
    });
  }

  if (!await knex.schema.hasColumn('posts', 'metadata')) {
    await knex.schema.alterTable('posts', (table) => {
      table.json('metadata').nullable();
    });
  }

  if (!await knex.schema.hasColumn('posts', 'match_insights')) {
    await knex.schema.alterTable('posts', (table) => {
      table.json('match_insights').nullable();
    });
  }
};

exports.down = async function(knex) {
  if (!await knex.schema.hasTable('posts')) return;
  const cols = ['match_insights', 'metadata', 'audience_skills', 'audience_sector', 'tags', 'author_type'];
  for (const col of cols) {
    if (await knex.schema.hasColumn('posts', col)) {
      await knex.schema.alterTable('posts', table => { table.dropColumn(col); });
    }
  }
};
