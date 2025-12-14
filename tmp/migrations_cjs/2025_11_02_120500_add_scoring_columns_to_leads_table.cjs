// Auto-generated from 2025_11_02_120500_add_scoring_columns_to_leads_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  await knex.schema.alterTable('leads', function(table) {
    if (!table.hasColumn && false) {
      // placeholder - we use knex.schema.hasColumn checks outside callback
    }
  });

  if (!await knex.schema.hasColumn('leads', 'qualification_score')) {
    await knex.schema.alterTable('leads', function(table) {
      table.integer('qualification_score').unsigned().nullable();
    });
  }

  if (!await knex.schema.hasColumn('leads', 'qualification_grade')) {
    await knex.schema.alterTable('leads', function(table) {
      table.string('qualification_grade', 8).nullable();
    });
  }

  if (!await knex.schema.hasColumn('leads', 'qualification_priority')) {
    await knex.schema.alterTable('leads', function(table) {
      table.string('qualification_priority', 20).nullable();
    });
  }

  if (!await knex.schema.hasColumn('leads', 'qualification_factors')) {
    await knex.schema.alterTable('leads', function(table) {
      table.json('qualification_factors').nullable();
    });
  }

  if (!await knex.schema.hasColumn('leads', 'ai_summary')) {
    await knex.schema.alterTable('leads', function(table) {
      table.text('ai_summary').nullable();
    });
  }

  if (!await knex.schema.hasColumn('leads', 'ai_recommendations')) {
    await knex.schema.alterTable('leads', function(table) {
      table.text('ai_recommendations').nullable();
    });
  }

  if (!await knex.schema.hasIndex('leads', 'leads_qualification_priority_idx')) {
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
    if (await knex.schema.hasColumn('leads', c)) {
      await knex.schema.alterTable('leads', function(table) { table.dropColumn(c); });
    }
  }
};
