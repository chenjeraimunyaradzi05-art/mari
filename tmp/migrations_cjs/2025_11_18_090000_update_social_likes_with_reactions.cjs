// Auto-generated from 2025_11_18_090000_update_social_likes_with_reactions.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_likes')) {
    if (!await knex.schema.hasColumn('social_likes', 'user_id')) {
      await knex.schema.alterTable('social_likes', (table) => {
        table.bigInteger('user_id').unsigned().nullable().after('social_profile_id');
        table.foreign('user_id').references('users.id').onDelete('SET NULL');
      });
    }

    if (!await knex.schema.hasColumn('social_likes', 'social_post_id')) {
      await knex.schema.alterTable('social_likes', (table) => {
        table.bigInteger('social_post_id').unsigned().nullable().after('user_id');
        table.foreign('social_post_id').references('social_posts.id').onDelete('CASCADE');
      });
    }

    if (!await knex.schema.hasColumn('social_likes', 'reaction')) {
      await knex.schema.alterTable('social_likes', (table) => {
        table.string('reaction', 30).defaultTo('like').after('liked_at');
        table.index(['reaction', 'liked_at'], 'social_likes_reaction_idx');
      });
    }
  }

  if (await knex.schema.hasTable('social_posts') && !await knex.schema.hasColumn('social_posts', 'reaction_breakdown')) {
    await knex.schema.alterTable('social_posts', (table) => {
      table.json('reaction_breakdown').nullable().after('likes_count');
    });
  }
};

exports.down = async function(knex) {
  if (await knex.schema.hasTable('social_likes')) {
    if (await knex.schema.hasColumn('social_likes', 'reaction')) {
      await knex.schema.alterTable('social_likes', (table) => {
        table.dropIndex('social_likes_reaction_idx');
        table.dropColumn('reaction');
      });
    }

    if (await knex.schema.hasColumn('social_likes', 'social_post_id')) {
      await knex.schema.alterTable('social_likes', (table) => {
        table.dropForeign(['social_post_id']);
        table.dropColumn('social_post_id');
      });
    }

    if (await knex.schema.hasColumn('social_likes', 'user_id')) {
      await knex.schema.alterTable('social_likes', (table) => {
        table.dropForeign(['user_id']);
        table.dropColumn('user_id');
      });
    }
  }

  if (await knex.schema.hasTable('social_posts') && await knex.schema.hasColumn('social_posts', 'reaction_breakdown')) {
    await knex.schema.alterTable('social_posts', (table) => {
      table.dropColumn('reaction_breakdown');
    });
  }
};
