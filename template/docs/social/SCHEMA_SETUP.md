# Social Platform Schema Setup (0-5%)

The first 5% increment establishes the database foundation for the social experience.

## Applied Migrations

| Migration | Purpose |
| --- | --- |
| `2025_11_04_000001_create_social_profiles_table.php` | Polymorphic social profiles with counts, privacy flags, and verification state. |
| `2025_11_15_000001_create_social_posts_table.php` | Core posts table with AI metadata, visibility, and engagement counters. |
| `2025_11_15_000002_create_social_media_table.php` | Media attachments (images, video, carousels) with optional AI analysis. |
| `2025_11_15_000003_create_social_follows_table.php` | Follow graph with notification preferences and close-friend toggle. |
| `2025_11_15_000004_create_social_likes_table.php` | Polymorphic likes for posts and comments. |
| `2025_11_15_000005_create_social_comments_table.php` | Threaded comments with AI sentiment placeholders and reply counters. |
| `2025_11_26_100000_create_media_upload_sessions_table.php` | Chunked upload session tracking with quotas, TTL, and metadata. |
| `2025_11_26_100001_create_media_upload_chunks_table.php` | Individual chunk persistence backing resumable uploads. |

## Next Steps

1. **Run migrations locally** once your `.env` is configured:
   - `php artisan migrate`
   - `php artisan storage:link`
2. **Prepare storage directories** for public uploads:
   - `mkdir -p storage/app/public/{avatars,covers,posts/images,posts/videos,stories,reels}`
3. **Seed sample data** after the 5-10% increment introduces the Eloquent models and factories.
4. **Schedule the reconciliation session** (post 10%) to map remaining PRD pillars (career intelligence, advertising, vertical UX) onto future increments.

Document updated: 15 Nov 2025.
