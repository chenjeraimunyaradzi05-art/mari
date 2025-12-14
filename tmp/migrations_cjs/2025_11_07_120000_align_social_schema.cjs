// Auto-generated from 2025_11_07_120000_align_social_schema.php
// Ported from Laravel migration to Knex up/down

async function hasIndex(knex, tableName, indexName) {
  const client = (knex.client && knex.client.config && knex.client.config.client) || '';
  if (!client || !client.toString().startsWith('mysql')) return false;
  const result = await knex.raw(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = ?`, [indexName]);
  return result && result[0] && result[0].length > 0;
}

exports.up = async function(knex) {
  if (await knex.schema.hasTable('social_profiles')) {
    await knex.schema.alterTable('social_profiles', (table) => {});

    if (!await knex.schema.hasColumn('social_profiles', 'profileable_type')) {
      await knex.schema.alterTable('social_profiles', (table) => {
        table.string('profileable_type').nullable();
        table.bigInteger('profileable_id').unsigned().nullable();
        table.index(['profileable_type', 'profileable_id'], 'social_profiles_profileable_index');
      });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'username')) {
      await knex.schema.alterTable('social_profiles', (table) => {
        table.string('username').nullable();
        table.unique('username', 'social_profiles_username_unique');
      });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'display_name')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.string('display_name').nullable(); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'bio')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.text('bio').nullable(); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'avatar')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.string('avatar').nullable(); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'cover_photo')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.string('cover_photo').nullable(); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'website')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.string('website').nullable(); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'social_links')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.json('social_links').nullable(); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'profile_type')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.string('profile_type', 40).notNullable().defaultTo('candidate'); table.index('profile_type', 'social_profiles_profile_type_index'); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'is_verified')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.boolean('is_verified').notNullable().defaultTo(false); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'is_private')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.boolean('is_private').notNullable().defaultTo(false); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'following_count')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.integer('following_count').unsigned().notNullable().defaultTo(0); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'posts_count')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.integer('posts_count').unsigned().notNullable().defaultTo(0); });
    }

    if (!await knex.schema.hasColumn('social_profiles', 'deleted_at')) {
      await knex.schema.alterTable('social_profiles', (table) => { table.timestamp('deleted_at').nullable(); });
    }

    // Copy handle -> username if needed
    if (await knex.schema.hasColumn('social_profiles', 'handle')) {
      await knex('social_profiles').whereNull('username').whereNotNull('handle').update({ username: knex.raw('handle') });
    }

    const client = (knex.client && (knex.client.config && knex.client.config.client)) || '';
    const driver = client && client.toString().startsWith('sqlite') ? 'sqlite' : client && client.toString().startsWith('mysql') ? 'mysql' : 'other';
    // display_name default fill
    if (driver === 'sqlite') {
      await knex('social_profiles').whereNull('display_name').update({ display_name: knex.raw("COALESCE(username, 'profile-' || id)") });
    } else {
      await knex('social_profiles').whereNull('display_name').update({ display_name: knex.raw("COALESCE(username, CONCAT('profile-', id))") });
    }

    // MySQL fulltext
    if (client && client.toString().startsWith('mysql')) {
      const hasFt = await hasIndex(knex, 'social_profiles', 'social_profiles_search_fulltext');
      if (!hasFt && await knex.schema.hasColumn('social_profiles', 'username')) {
        await knex.raw('ALTER TABLE social_profiles ADD FULLTEXT INDEX social_profiles_search_fulltext (username, display_name, bio)');
      }
    }
  }

  if (await knex.schema.hasTable('social_posts')) {
    if (!await knex.schema.hasColumn('social_posts', 'social_profile_id')) {
      await knex.schema.alterTable('social_posts', (table) => {
        table.bigInteger('social_profile_id').unsigned().nullable();
        table.foreign('social_profile_id').references('id').inTable('social_profiles').onDelete('SET NULL');
        table.index('social_profile_id', 'social_posts_profile_index');
      });
    }

    if (!await knex.schema.hasColumn('social_posts', 'post_type')) {
      await knex.schema.alterTable('social_posts', (table) => { table.enu('post_type', ['post','reel','story','article']).notNullable().defaultTo('post'); });
    }

    if (!await knex.schema.hasColumn('social_posts', 'caption')) await knex.schema.alterTable('social_posts', (table) => { table.text('caption').nullable(); });
    if (!await knex.schema.hasColumn('social_posts', 'media')) await knex.schema.alterTable('social_posts', (table) => { table.json('media').nullable(); });
    if (!await knex.schema.hasColumn('social_posts', 'location')) await knex.schema.alterTable('social_posts', (table) => { table.string('location').nullable(); });
    if (!await knex.schema.hasColumn('social_posts', 'tags')) await knex.schema.alterTable('social_posts', (table) => { table.json('tags').nullable(); });
    if (!await knex.schema.hasColumn('social_posts', 'mentions')) await knex.schema.alterTable('social_posts', (table) => { table.json('mentions').nullable(); });
    if (!await knex.schema.hasColumn('social_posts', 'likes_count')) await knex.schema.alterTable('social_posts', (table) => { table.integer('likes_count').unsigned().notNullable().defaultTo(0); });
    if (!await knex.schema.hasColumn('social_posts', 'comments_count')) await knex.schema.alterTable('social_posts', (table) => { table.integer('comments_count').unsigned().notNullable().defaultTo(0); });
    if (!await knex.schema.hasColumn('social_posts', 'shares_count')) await knex.schema.alterTable('social_posts', (table) => { table.integer('shares_count').unsigned().notNullable().defaultTo(0); });
    if (!await knex.schema.hasColumn('social_posts', 'views_count')) await knex.schema.alterTable('social_posts', (table) => { table.integer('views_count').unsigned().notNullable().defaultTo(0); });
    if (!await knex.schema.hasColumn('social_posts', 'is_pinned')) await knex.schema.alterTable('social_posts', (table) => { table.boolean('is_pinned').notNullable().defaultTo(false); });
    if (!await knex.schema.hasColumn('social_posts', 'comments_disabled')) await knex.schema.alterTable('social_posts', (table) => { table.boolean('comments_disabled').notNullable().defaultTo(false); });
    if (!await knex.schema.hasColumn('social_posts', 'expires_at')) await knex.schema.alterTable('social_posts', (table) => { table.timestamp('expires_at').nullable(); });
    if (!await knex.schema.hasColumn('social_posts', 'ai_engagement_score')) await knex.schema.alterTable('social_posts', (table) => { table.float('ai_engagement_score').notNullable().defaultTo(0); });
    if (!await knex.schema.hasColumn('social_posts', 'ai_tags')) await knex.schema.alterTable('social_posts', (table) => { table.json('ai_tags').nullable(); });

    // Copy content -> caption if caption missing
    if (await knex.schema.hasColumn('social_posts', 'content') && await knex.schema.hasColumn('social_posts', 'caption')) {
      await knex('social_posts').whereNull('caption').update({ caption: knex.raw('content') });
    }
  }

  if (await knex.schema.hasTable('social_post_media')) {
    if (!await knex.schema.hasColumn('social_post_media', 'thumbnail_path')) await knex.schema.alterTable('social_post_media', (table) => { table.string('thumbnail_path').nullable(); });
    if (!await knex.schema.hasColumn('social_post_media', 'mime_type')) await knex.schema.alterTable('social_post_media', (table) => { table.string('mime_type', 120).nullable(); });
    if (!await knex.schema.hasColumn('social_post_media', 'file_size')) await knex.schema.alterTable('social_post_media', (table) => { table.integer('file_size').unsigned().nullable(); });
    if (!await knex.schema.hasColumn('social_post_media', 'width')) await knex.schema.alterTable('social_post_media', (table) => { table.integer('width').unsigned().nullable(); });
    if (!await knex.schema.hasColumn('social_post_media', 'height')) await knex.schema.alterTable('social_post_media', (table) => { table.integer('height').unsigned().nullable(); });
    if (!await knex.schema.hasColumn('social_post_media', 'duration')) await knex.schema.alterTable('social_post_media', (table) => { table.integer('duration').unsigned().nullable(); });
    if (!await knex.schema.hasColumn('social_post_media', 'sort_order')) {
      await knex.schema.alterTable('social_post_media', (table) => { table.smallint('sort_order').unsigned().notNullable().defaultTo(0); table.index(['social_post_id', 'sort_order'], 'spm_post_sort_idx'); });
    }
    if (!await knex.schema.hasColumn('social_post_media', 'ai_analysis')) await knex.schema.alterTable('social_post_media', (table) => { table.json('ai_analysis').nullable(); });
    if (!await knex.schema.hasColumn('social_post_media', 'filters')) await knex.schema.alterTable('social_post_media', (table) => { table.json('filters').nullable(); });
  }

  if (await knex.schema.hasTable('social_post_comments')) {
    if (!await knex.schema.hasColumn('social_post_comments', 'social_profile_id')) {
      await knex.schema.alterTable('social_post_comments', (table) => {
        table.bigInteger('social_profile_id').unsigned().nullable();
        table.foreign('social_profile_id').references('id').inTable('social_profiles').onDelete('SET NULL');
      });
    }
    if (!await knex.schema.hasColumn('social_post_comments', 'mentions')) await knex.schema.alterTable('social_post_comments', (table) => { table.json('mentions').nullable(); });
    if (!await knex.schema.hasColumn('social_post_comments', 'likes_count')) await knex.schema.alterTable('social_post_comments', (table) => { table.integer('likes_count').unsigned().notNullable().defaultTo(0); });
    if (!await knex.schema.hasColumn('social_post_comments', 'replies_count')) await knex.schema.alterTable('social_post_comments', (table) => { table.integer('replies_count').unsigned().notNullable().defaultTo(0); });
    if (!await knex.schema.hasColumn('social_post_comments', 'is_pinned')) await knex.schema.alterTable('social_post_comments', (table) => { table.boolean('is_pinned').notNullable().defaultTo(false); });
    if (!await knex.schema.hasColumn('social_post_comments', 'ai_sentiment')) await knex.schema.alterTable('social_post_comments', (table) => { table.json('ai_sentiment').nullable(); });
    if (!await knex.schema.hasColumn('social_post_comments', 'deleted_at')) await knex.schema.alterTable('social_post_comments', (table) => { table.timestamp('deleted_at').nullable(); });
  }

  if (await knex.schema.hasTable('social_post_reactions')) {
    if (!await knex.schema.hasColumn('social_post_reactions', 'social_profile_id')) await knex.schema.alterTable('social_post_reactions', (table) => { table.bigInteger('social_profile_id').unsigned().nullable(); table.foreign('social_profile_id').references('id').inTable('social_profiles').onDelete('SET NULL'); });
    if (!await knex.schema.hasColumn('social_post_reactions', 'liked_at')) await knex.schema.alterTable('social_post_reactions', (table) => { table.timestamp('liked_at').defaultTo(knex.fn.now()).notNullable(); });
    if (!await knex.schema.hasColumn('social_post_reactions', 'likeable_type')) {
      await knex.schema.alterTable('social_post_reactions', (table) => { table.string('likeable_type').nullable(); table.bigInteger('likeable_id').unsigned().nullable(); table.unique(['social_profile_id', 'likeable_type', 'likeable_id'], 'social_post_reactions_likeable_unique'); });
    }
  }

  // Migrate legacy social_follows table name if present
  if (await knex.schema.hasTable('social_follows') && !await knex.schema.hasTable('legacy_social_follows')) {
    await knex.schema.renameTable('social_follows', 'legacy_social_follows');
  }

  if (!await knex.schema.hasTable('social_follows')) {
    await knex.schema.createTable('social_follows', (table) => {
      table.bigIncrements('id');
      table.bigInteger('follower_id').unsigned().notNullable();
      table.bigInteger('following_id').unsigned().notNullable();
      table.boolean('is_close_friend').notNullable().defaultTo(false);
      table.boolean('notifications_enabled').notNullable().defaultTo(true);
      table.timestamp('followed_at').defaultTo(knex.fn.now()).notNullable();
      table.timestamps(true, true);

      table.unique(['follower_id', 'following_id'], 'social_follows_unique_pair');
      table.index(['follower_id', 'followed_at'], 'social_follows_follower_idx');
      table.index(['following_id', 'followed_at'], 'social_follows_following_idx');
      table.foreign('follower_id', 'social_follows_profile_follower_fk').references('id').inTable('social_profiles').onDelete('CASCADE');
      table.foreign('following_id', 'social_follows_profile_following_fk').references('id').inTable('social_profiles').onDelete('CASCADE');
    });
  }
};

exports.down = async function(knex) {
  // Reverse operations in roughly reverse order
  if (await knex.schema.hasTable('social_posts')) {
    await knex.schema.alterTable('social_posts', (table) => {
      const columns = ['social_profile_id','post_type','caption','media','location','tags','mentions','likes_count','comments_count','shares_count','views_count','is_pinned','comments_disabled','expires_at','ai_engagement_score','ai_tags'];
      // For 'social_profile_id' we need to drop FK and index
      if (columns.includes('social_profile_id') && await knex.schema.hasColumn('social_posts','social_profile_id')) {
        table.dropForeign('social_profile_id');
        // Not all DBs support dropping named index easily here
      }
      for (const col of columns) {
        if (await knex.schema.hasColumn('social_posts', col)) {
          if (col !== 'social_profile_id') {
            table.dropColumn(col);
          }
        }
      }
    });
  }

  if (await knex.schema.hasTable('social_post_media')) {
    await knex.schema.alterTable('social_post_media', (table) => {
      const columns = ['thumbnail_path','mime_type','file_size','width','height','duration','sort_order','ai_analysis','filters'];
      for (const col of columns) {
        if (await knex.schema.hasColumn('social_post_media', col)) {
          if (col === 'sort_order') {
            try { table.dropIndex(['social_post_id','sort_order'], 'spm_post_sort_idx'); } catch (e) {}
          }
          try { table.dropColumn(col); } catch (e) {}
        }
      }
    });
  }

  if (await knex.schema.hasTable('social_post_comments')) {
    await knex.schema.alterTable('social_post_comments', (table) => {
      const columns = ['social_profile_id','mentions','likes_count','replies_count','is_pinned','ai_sentiment'];
      for (const col of columns) {
        if (await knex.schema.hasColumn('social_post_comments', col)) {
          if (col === 'social_profile_id') {
            try { table.dropForeign('social_profile_id'); } catch (e) {}
          } else {
            try { table.dropColumn(col); } catch (e) {}
          }
        }
      }
      if (await knex.schema.hasColumn('social_post_comments', 'deleted_at')) {
        try { table.dropColumn('deleted_at'); } catch (e) {}
      }
    });
  }

  if (await knex.schema.hasTable('social_post_reactions')) {
    await knex.schema.alterTable('social_post_reactions', (table) => {
      if (await knex.schema.hasColumn('social_post_reactions', 'social_profile_id')) {
        try { table.dropForeign('social_profile_id'); } catch (e) {}
      }
      if (await knex.schema.hasColumn('social_post_reactions', 'liked_at')) {
        try { table.dropColumn('liked_at'); } catch (e) {}
      }
      if (await knex.schema.hasColumn('social_post_reactions', 'likeable_type')) {
        try { table.dropUnique('social_post_reactions_likeable_unique'); } catch (e) {}
        try { table.dropColumn('likeable_type'); table.dropColumn('likeable_id'); } catch (e) {}
      }
    });
  }

  if (await knex.schema.hasTable('social_follows')) {
    await knex.schema.dropTable('social_follows');
  }

  if (await knex.schema.hasTable('legacy_social_follows') && !await knex.schema.hasTable('social_follows')) {
    await knex.schema.renameTable('legacy_social_follows', 'social_follows');
  }

  if (await knex.schema.hasTable('social_profiles')) {
    await knex.schema.alterTable('social_profiles', (table) => {
      const profileDropColumns = ['profileable_type','profileable_id','username','display_name','bio','avatar','cover_photo','website','social_links','profile_type','is_verified','is_private','following_count','posts_count'];
      for (const col of profileDropColumns) {
        if (await knex.schema.hasColumn('social_profiles', col)) {
          if (col === 'username') {
            try { table.dropUnique('social_profiles_username_unique'); } catch (e) {}
          }
          if (col === 'profile_type') {
            try { table.dropIndex(['profile_type'], 'social_profiles_profile_type_index'); } catch (e) {}
          }
          try { table.dropColumn(col); } catch (e) {}
        }
      }
      if (await knex.schema.hasColumn('social_profiles', 'deleted_at')) {
        try { table.dropColumn('deleted_at'); } catch (e) {}
      }
    });
    const client = (knex.client && knex.client.config && knex.client.config.client) || '';
    if (client && client.toString().startsWith('mysql')) {
      const hasFt = await hasIndex(knex, 'social_profiles', 'social_profiles_search_fulltext');
      if (hasFt) {
        await knex.raw('ALTER TABLE social_profiles DROP INDEX social_profiles_search_fulltext');
      }
    }
  }
};
