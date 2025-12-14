// Auto-generated from 2025_11_07_121000_backfill_social_schema.php
// Ported from Laravel migration to Knex up/down

async function chunkById(knex, table, callback, chunkSize = 100) {
  let lastId = 0;
  while (true) {
    const rows = await knex(table).select('*').where('id', '>', lastId).orderBy('id').limit(chunkSize);
    if (!rows || rows.length === 0) break;
    await callback(rows);
    lastId = rows[rows.length - 1].id;
  }
}

exports.up = async function(knex) {
  // Backfill social_profiles
  if (await knex.schema.hasTable('social_profiles')) {
    await chunkById(knex, 'social_profiles', async (profiles) => {
      for (const profile of profiles) {
        const updates = {};
        if (profile.username == null) {
          updates.username = profile.handle || `member_${profile.id}`;
        }
        if (profile.display_name == null) {
          updates.display_name = profile.handle || updates.username || profile.username || `Member ${profile.id}`;
        }
        if (profile.profile_type == null) {
          updates.profile_type = profile.candidate_id ? 'candidate' : 'company';
        }
        if (profile.followers_count == null) updates.followers_count = 0;
        if (profile.following_count == null) updates.following_count = 0;
        if (profile.posts_count == null) updates.posts_count = 0;

        if (profile.profileable_type == null || profile.profileable_id == null) {
          let profileableType = null;
          let profileableId = null;
          if (profile.candidate_id) {
            profileableType = 'App\\Models\\Candidate';
            profileableId = profile.candidate_id;
          } else {
            const companyId = await knex('companies').where('user_id', profile.user_id).first('id').then(r => r && r.id);
            if (companyId) {
              profileableType = 'App\\Models\\Company';
              profileableId = companyId;
            } else {
              profileableType = 'App\\Models\\User';
              profileableId = profile.user_id;
              updates.profile_type = updates.profile_type || 'user';
            }
          }
          updates.profileable_type = profileableType;
          updates.profileable_id = profileableId;
        }

        if (Object.keys(updates).length > 0) {
          await knex('social_profiles').where('id', profile.id).update(updates);
        }
      }
    });
  }

  // Backfill social_posts
  if (await knex.schema.hasTable('social_posts')) {
    await chunkById(knex, 'social_posts', async (posts) => {
      for (const post of posts) {
        const updates = {};
        if (post.social_profile_id == null) {
          const profileId = await knex('social_profiles').where('user_id', post.user_id).first('id').then(r => r && r.id);
          if (profileId) updates.social_profile_id = profileId;
        }
        if (post.post_type == null) updates.post_type = 'post';
        if (Object.keys(updates).length > 0) {
          await knex('social_posts').where('id', post.id).update(updates);
        }
      }
    });
  }

  // Backfill social_post_media sort_order
  if (await knex.schema.hasTable('social_post_media')) {
    await knex('social_post_media').whereNull('sort_order').update({ sort_order: 0 });
  }

  // Convert legacy_social_follows to social_follows
  if (await knex.schema.hasTable('social_follows') && await knex.schema.hasTable('legacy_social_follows')) {
    await chunkById(knex, 'legacy_social_follows', async (rows) => {
      for (const row of rows) {
        const followerProfileId = await knex('social_profiles').where('user_id', row.follower_id).first('id').then(r => r && r.id);
        if (!followerProfileId) continue;

        let followingProfileId = null;
        if (row.followable_type === 'App\\Models\\Candidate') {
          followingProfileId = await knex('social_profiles').where('candidate_id', row.followable_id).first('id').then(r => r && r.id);
        } else if (row.followable_type === 'App\\Models\\User') {
          followingProfileId = await knex('social_profiles').where('user_id', row.followable_id).first('id').then(r => r && r.id);
        } else if (row.followable_type === 'App\\Models\\Company') {
          const companyUserId = await knex('companies').where('id', row.followable_id).first('user_id').then(r => r && r.user_id);
          if (companyUserId) {
            followingProfileId = await knex('social_profiles').where('user_id', companyUserId).first('id').then(r => r && r.id);
          }
        }

        if (!followingProfileId) {
          followingProfileId = await knex('social_profiles').where('user_id', row.followable_id).first('id').then(r => r && r.id);
        }
        if (!followingProfileId) continue;

        const insert = {
          follower_id: followerProfileId,
          following_id: followingProfileId,
          is_close_friend: false,
          notifications_enabled: true,
          followed_at: row.followed_at || new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        };

        try {
          await knex('social_follows').insert(insert).onConflict(['follower_id', 'following_id']).merge();
        } catch (e) {
          // some DBs may not support onConflict; fallback to update/insert
          const exists = await knex('social_follows').where({ follower_id: followerProfileId, following_id: followingProfileId }).first();
          if (!exists) {
            await knex('social_follows').insert(insert);
          }
        }
      }
    }, 200);
  }
};

exports.down = async function(knex) {
  // No-op: data backfill should not be reversed automatically.
};
