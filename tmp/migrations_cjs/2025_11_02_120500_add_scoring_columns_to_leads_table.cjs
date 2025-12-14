// Auto-generated from 2025_11_02_120500_add_scoring_columns_to_leads_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  const __has_col_up_0 = await knex.schema.hasColumn('leads', 'qualification_score');
  const __has_col_up_1 = await knex.schema.hasColumn('leads', 'qualification_grade');
  const __has_col_up_2 = await knex.schema.hasColumn('leads', 'qualification_priority');
  const __has_col_up_3 = await knex.schema.hasColumn('leads', 'qualification_factors');
  const __has_col_up_4 = await knex.schema.hasColumn('leads', 'ai_summary');
  const __has_col_up_5 = await knex.schema.hasColumn('leads', 'ai_recommendations');
  const cols = ['qualification_score','qualification_grade','qualification_priority','qualification_factors','ai_summary','ai_recommendations'];
  const originalHas = {};
  for (const cc of cols) originalHas[cc] = await knex.schema.hasColumn('leads', cc);
  await knex.schema.alterTable('leads', function(table) {
    if (!table.hasColumn && false) {
      // placeholder - we use knex.schema.hasColumn checks outside callback
    }
  });

  if (!__has_col_up_0) {
    await knex.schema.alterTable('leads', function(table) {
      table.integer('qualification_score').unsigned().nullable();
    });
  }

  if (!__has_col_up_1) {
    await knex.schema.alterTable('leads', function(table) {
      table.string('qualification_grade', 8).nullable();
    });
  }

  if (!__has_col_up_2) {
    await knex.schema.alterTable('leads', function(table) {
      table.string('qualification_priority', 20).nullable();
    });
  }

  if (!__has_col_up_3) {
    await knex.schema.alterTable('leads', function(table) {
      table.json('qualification_factors').nullable();
    });
  }

  if (!__has_col_up_4) {
    await knex.schema.alterTable('leads', function(table) {
      table.text('ai_summary').nullable();
    });
  }

  if (!__has_col_up_5) {
    await knex.schema.alterTable('leads', function(table) {
      table.text('ai_recommendations').nullable();
    });
  }

  const hasIndex = async (tableName, indexName) => {
    const client = String(knex.client.config.client);
    if (client.includes('sqlite')) {
      const r = await knex.raw("select name from sqlite_master where type='index' and name = ?", [indexName]);
      // knex returns rows differently across drivers; check contents
      return Array.isArray(r) ? (r.length > 0 && (Array.isArray(r[0]) ? r[0].length > 0 : true)) : !!r;
    }
    if (client.includes('mysql')) {
      const r = await knex.raw('SHOW INDEX FROM ?? WHERE Key_name = ?', [tableName, indexName]);
      return !!(r && r[0] && r[0].length > 0);
    }
    return false;
  };

  if (!(await hasIndex('leads', 'leads_qualification_priority_idx'))) {
    await knex.schema.alterTable('leads', function(table) {
      table.index('qualification_priority', 'leads_qualification_priority_idx');
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasIndex('leads', 'leads_qualification_priority_idx')) {
    await knex.schema.alterTable('leads', function(table) {
      table.dropIndex('qualification_priority', 'leads_qualification_priority_idx');
    });
  }

  const cols = [
    'qualification_score',
    'qualification_grade',
    'qualification_priority',
    'qualification_factors',
    'ai_summary',
    'ai_recommendations',
  ];
  for (const c of cols) {
    if (!originalHas[c]) {
      await knex.schema.alterTable('leads', function(table) { table.dropColumn(c); });
    }
  }
};
