// Auto-generated from 2025_11_07_122500_update_social_profiles_and_comments.php
// Ported from Laravel migration to Knex up/down

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_profiles')) {
    await knex('social_profiles').whereNull('is_verified').update({ is_verified: false });
    await knex('social_profiles').whereNull('is_private').update({ is_private: false });
    await knex('social_profiles').whereNull('following_count').update({ following_count: 0 });
    await knex('social_profiles').whereNull('posts_count').update({ posts_count: 0 });
  }

  if (await knex.schema.hasTable('social_posts')) {
    await knex('social_posts').whereNull('post_type').update({ post_type: 'post' });
    await knex('social_posts').whereNull('likes_count').update({ likes_count: 0 });
    await knex('social_posts').whereNull('comments_count').update({ comments_count: 0 });
    await knex('social_posts').whereNull('shares_count').update({ shares_count: 0 });
    await knex('social_posts').whereNull('views_count').update({ views_count: 0 });
    await knex('social_posts').whereNull('is_pinned').update({ is_pinned: false });
    await knex('social_posts').whereNull('comments_disabled').update({ comments_disabled: false });
  }

  if (await knex.schema.hasTable('social_post_comments')) {
    await knex('social_post_comments').whereNull('mentions').update({ mentions: JSON.stringify([]) });
    await knex('social_post_comments').whereNull('likes_count').update({ likes_count: 0 });
    await knex('social_post_comments').whereNull('replies_count').update({ replies_count: 0 });
    await knex('social_post_comments').whereNull('is_pinned').update({ is_pinned: false });
  }

  if (await knex.schema.hasTable('social_post_media')) {
    await knex('social_post_media').whereNull('sort_order').update({ sort_order: 0 });
  }
};

exports.down = async function(knex) {
  // Data normalisation only; no automatic reversal.
};
