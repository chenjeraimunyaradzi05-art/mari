// Auto-generated from 2025_11_03_201500_add_social_posting_columns_to_plans_table.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (!await knex.schema.hasTable('plans')) return;

  if (!await knex.schema.hasColumn('plans', 'allow_social_posts')) {
    await knex.schema.alterTable('plans', function(table) {
      table.boolean('allow_social_posts').notNullable().defaultTo(false);
    });
  }

  if (!await knex.schema.hasColumn('plans', 'social_post_limit')) {
    await knex.schema.alterTable('plans', function(table) {
      table.integer('social_post_limit').notNullable().defaultTo(0);
    });
  }

  // Backfill: mark premium plans to allow social posts with limit 50
  try {
    await knex('plans').where('label', 'like', '%premium%').update({ allow_social_posts: true, social_post_limit: 50 });
  } catch (e) {
    // ignore if table doesn't exist or update fails in migration context
  }
};

exports.down = async function(knex) {
  if (!await knex.schema.hasTable('plans')) return;

  if (await knex.schema.hasColumn('plans', 'social_post_limit')) {
    await knex.schema.alterTable('plans', function(table) { table.dropColumn('social_post_limit'); });
  }

  if (await knex.schema.hasColumn('plans', 'allow_social_posts')) {
    await knex.schema.alterTable('plans', function(table) { table.dropColumn('allow_social_posts'); });
  }
};
