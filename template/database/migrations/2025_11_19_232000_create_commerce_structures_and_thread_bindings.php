<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private array $postTypes = [
        'post',
        'reel',
        'story',
        'article',
        'poll',
        'live_stream',
        'commerce_drop',
        'community_alert',
        'ai_digest',
    ];

    private array $legacyPostTypes = ['post', 'reel', 'story', 'article'];

    public function up(): void
    {
        if (Schema::hasTable('social_posts')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                if (! Schema::hasColumn('social_posts', 'content_format')) {
                    $table->string('content_format')->nullable()->after('post_type');
                }

                if (! Schema::hasColumn('social_posts', 'stream_context')) {
                    $table->json('stream_context')->nullable()->after('meta');
                }

                if (! Schema::hasColumn('social_posts', 'ai_moderation_meta')) {
                    $table->json('ai_moderation_meta')->nullable()->after('ai_tags');
                }
            });

            $this->updatePostTypeEnum();
        }

        $this->createPollTables();
        $this->createLiveStreamTables();
        $this->createSaveCollectionsTables();
        $this->createBlockListTables();
        $this->createThreadBindingTable();
        $this->createCommerceTables();
    }

    public function down(): void
    {
        Schema::dropIfExists('commerce_order_events');
        Schema::dropIfExists('commerce_order_items');
        Schema::dropIfExists('commerce_orders');
        Schema::dropIfExists('commerce_payout_batches');
        Schema::dropIfExists('commerce_product_variants');
        Schema::dropIfExists('commerce_products');
        Schema::dropIfExists('commerce_collections');
        Schema::dropIfExists('commerce_channels');

        Schema::dropIfExists('social_thread_bindings');
        Schema::dropIfExists('social_block_list_entries');
        Schema::dropIfExists('social_block_lists');
        Schema::dropIfExists('social_post_collection_items');
        Schema::dropIfExists('social_post_collections');
        Schema::dropIfExists('social_live_stream_gifts');
        Schema::dropIfExists('social_live_stream_metrics');
        Schema::dropIfExists('social_live_streams');
        Schema::dropIfExists('social_post_poll_votes');
        Schema::dropIfExists('social_post_poll_options');
        Schema::dropIfExists('social_post_polls');

        if (Schema::hasTable('social_posts')) {
            Schema::table('social_posts', function (Blueprint $table): void {
                if (Schema::hasColumn('social_posts', 'content_format')) {
                    $table->dropColumn('content_format');
                }

                if (Schema::hasColumn('social_posts', 'stream_context')) {
                    $table->dropColumn('stream_context');
                }

                if (Schema::hasColumn('social_posts', 'ai_moderation_meta')) {
                    $table->dropColumn('ai_moderation_meta');
                }
            });

            $this->revertPostTypeEnum();
        }
    }

    private function updatePostTypeEnum(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            $enumValues = "'".implode("','", $this->postTypes)."'";
            DB::statement("ALTER TABLE social_posts MODIFY post_type ENUM($enumValues) DEFAULT 'post'");
        }
    }

    private function revertPostTypeEnum(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            $enumValues = "'".implode("','", $this->legacyPostTypes)."'";
            DB::statement("ALTER TABLE social_posts MODIFY post_type ENUM($enumValues) DEFAULT 'post'");
        }
    }

    private function createPollTables(): void
    {
        if (! Schema::hasTable('social_post_polls')) {
            Schema::create('social_post_polls', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_post_id')->unique()->constrained()->cascadeOnDelete();
                $table->string('question');
                $table->text('summary')->nullable();
                $table->string('status')->default('open');
                $table->boolean('allow_multiple')->default(false);
                $table->timestamp('closes_at')->nullable();
                $table->json('ai_moderation_meta')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('social_post_poll_options')) {
            Schema::create('social_post_poll_options', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_post_poll_id')->constrained()->cascadeOnDelete();
                $table->string('label');
                $table->unsignedInteger('display_order')->default(0);
                $table->unsignedBigInteger('votes_count')->default(0);
                $table->json('ai_metadata')->nullable();
                $table->timestamps();

                $table->index(['social_post_poll_id', 'display_order']);
            });
        }

        if (! Schema::hasTable('social_post_poll_votes')) {
            Schema::create('social_post_poll_votes', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_post_poll_id')->constrained()->cascadeOnDelete();
                $table->foreignId('poll_option_id')->constrained('social_post_poll_options')->cascadeOnDelete();
                $table->foreignId('social_profile_id')->constrained()->cascadeOnDelete();
                $table->float('vote_weight')->default(1);
                $table->float('trust_score')->default(1);
                $table->json('meta')->nullable();
                $table->timestamp('voted_at')->useCurrent();
                $table->timestamps();

                $table->unique(['poll_option_id', 'social_profile_id'], 'poll_option_voter_unique');
                $table->index(['social_post_poll_id', 'social_profile_id'], 'poll_profile_idx');
            });
        }
    }

    private function createLiveStreamTables(): void
    {
        if (! Schema::hasTable('social_live_streams')) {
            Schema::create('social_live_streams', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_post_id')->constrained()->cascadeOnDelete();
                $table->foreignId('community_group_id')->nullable()->constrained()->nullOnDelete();
                $table->string('title');
                $table->string('status')->default('scheduled');
                $table->timestamp('scheduled_for')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('ended_at')->nullable();
                $table->string('ingest_url')->nullable();
                $table->string('playback_url')->nullable();
                $table->string('stream_key')->nullable();
                $table->unsignedInteger('max_viewers')->default(0);
                $table->unsignedBigInteger('total_watch_time')->default(0);
                $table->json('stream_context')->nullable();
                $table->json('ai_moderation_meta')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['status', 'scheduled_for']);
            });
        }

        if (! Schema::hasTable('social_live_stream_metrics')) {
            Schema::create('social_live_stream_metrics', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_live_stream_id')->constrained()->cascadeOnDelete();
                $table->timestamp('captured_at');
                $table->unsignedInteger('concurrent_viewers')->default(0);
                $table->unsignedInteger('new_followers')->default(0);
                $table->decimal('tips_total', 12, 2)->default(0);
                $table->json('meta')->nullable();
                $table->timestamps();

                $table->index(['social_live_stream_id', 'captured_at'], 'live_stream_metrics_stream_time');
            });
        }

        if (! Schema::hasTable('social_live_stream_gifts')) {
            Schema::create('social_live_stream_gifts', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_live_stream_id')->constrained()->cascadeOnDelete();
                $table->foreignId('social_profile_id')->nullable()->constrained()->nullOnDelete();
                $table->decimal('amount', 12, 2);
                $table->char('currency', 3)->default('AUD');
                $table->json('payload')->nullable();
                $table->timestamp('recorded_at')->useCurrent();
                $table->timestamps();

                $table->index(['social_live_stream_id', 'recorded_at'], 'live_stream_gifts_stream_time');
            });
        }
    }

    private function createSaveCollectionsTables(): void
    {
        if (! Schema::hasTable('social_post_collections')) {
            Schema::create('social_post_collections', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_profile_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('slug');
                $table->text('description')->nullable();
                $table->boolean('is_private')->default(false);
                $table->unsignedInteger('items_count')->default(0);
                $table->timestamps();

                $table->unique(['social_profile_id', 'slug']);
            });
        }

        if (! Schema::hasTable('social_post_collection_items')) {
            Schema::create('social_post_collection_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_post_collection_id')->constrained()->cascadeOnDelete();
                $table->foreignId('social_post_id')->constrained()->cascadeOnDelete();
                $table->foreignId('social_post_save_id')->nullable()->constrained('social_post_saves')->nullOnDelete();
                $table->timestamp('saved_at')->useCurrent();
                $table->timestamps();

                $table->unique(['social_post_collection_id', 'social_post_id'], 'collection_post_unique');
            });
        }
    }

    private function createBlockListTables(): void
    {
        if (! Schema::hasTable('social_block_lists')) {
            Schema::create('social_block_lists', function (Blueprint $table): void {
                $table->id();
                $table->nullableMorphs('owner');
                $table->string('name');
                $table->string('scope')->default('profile');
                $table->string('status')->default('active');
                $table->json('rules')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['scope', 'status']);
            });
        }

        if (! Schema::hasTable('social_block_list_entries')) {
            Schema::create('social_block_list_entries', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_block_list_id')->constrained()->cascadeOnDelete();
                $table->morphs('blockable');
                $table->foreignId('added_by')->nullable()->constrained('social_profiles')->nullOnDelete();
                $table->string('reason')->nullable();
                $table->timestamp('expires_at')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(['social_block_list_id', 'blockable_type', 'blockable_id'], 'block_list_unique');
            });
        }
    }

    private function createThreadBindingTable(): void
    {
        if (! Schema::hasTable('social_thread_bindings')) {
            Schema::create('social_thread_bindings', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('social_thread_id')->constrained()->cascadeOnDelete();
                $table->morphs('bindable');
                $table->string('context')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(['social_thread_id', 'bindable_type', 'bindable_id'], 'thread_bindable_unique');
            });
        }
    }

    private function createCommerceTables(): void
    {
        if (! Schema::hasTable('commerce_channels')) {
            Schema::create('commerce_channels', function (Blueprint $table): void {
                $table->id();
                $table->morphs('owner');
                $table->string('name');
                $table->string('status')->default('active');
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('commerce_collections')) {
            Schema::create('commerce_collections', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('commerce_channel_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('slug');
                $table->text('description')->nullable();
                $table->foreignId('featured_post_id')->nullable()->constrained('social_posts')->nullOnDelete();
                $table->json('metadata')->nullable();
                $table->timestamp('published_at')->nullable();
                $table->timestamps();

                $table->unique(['commerce_channel_id', 'slug'], 'commerce_collection_slug_unique');
            });
        }

        if (! Schema::hasTable('commerce_products')) {
            Schema::create('commerce_products', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('commerce_channel_id')->constrained()->cascadeOnDelete();
                $table->foreignId('commerce_collection_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('social_post_id')->nullable()->constrained()->nullOnDelete();
                $table->string('name');
                $table->string('sku')->nullable();
                $table->string('status')->default('draft');
                $table->text('short_description')->nullable();
                $table->longText('long_description')->nullable();
                $table->decimal('base_price', 12, 2)->default(0);
                $table->char('currency', 3)->default('AUD');
                $table->unsignedInteger('inventory')->default(0);
                $table->json('attributes')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->unique(['commerce_channel_id', 'sku']);
            });
        }

        if (! Schema::hasTable('commerce_product_variants')) {
            Schema::create('commerce_product_variants', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('commerce_product_id')->constrained()->cascadeOnDelete();
                $table->string('name');
                $table->string('sku')->nullable();
                $table->decimal('price', 12, 2)->nullable();
                $table->unsignedInteger('inventory')->default(0);
                $table->json('attributes')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('commerce_payout_batches')) {
            Schema::create('commerce_payout_batches', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('commerce_channel_id')->constrained()->cascadeOnDelete();
                $table->string('status')->default('pending');
                $table->decimal('amount', 12, 2)->default(0);
                $table->char('currency', 3)->default('AUD');
                $table->timestamp('payout_date')->nullable();
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('commerce_orders')) {
            Schema::create('commerce_orders', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('commerce_channel_id')->constrained()->cascadeOnDelete();
                $table->foreignId('buyer_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
                $table->foreignId('commerce_payout_batch_id')->nullable()->constrained('commerce_payout_batches')->nullOnDelete();
                $table->foreignId('source_social_post_id')->nullable()->constrained('social_posts')->nullOnDelete();
                $table->string('status')->default('draft');
                $table->decimal('total', 12, 2)->default(0);
                $table->char('currency', 3)->default('AUD');
                $table->json('metadata')->nullable();
                $table->timestamp('placed_at')->nullable();
                $table->timestamp('fulfilled_at')->nullable();
                $table->timestamp('canceled_at')->nullable();
                $table->timestamps();

                $table->index(['commerce_channel_id', 'status']);
            });
        }

        if (! Schema::hasTable('commerce_order_items')) {
            Schema::create('commerce_order_items', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('commerce_order_id')->constrained()->cascadeOnDelete();
                $table->foreignId('commerce_product_id')->constrained()->cascadeOnDelete();
                $table->foreignId('commerce_product_variant_id')->nullable()->constrained()->nullOnDelete();
                $table->foreignId('social_post_id')->nullable()->constrained()->nullOnDelete();
                $table->unsignedInteger('quantity')->default(1);
                $table->decimal('unit_price', 12, 2)->default(0);
                $table->char('currency', 3)->default('AUD');
                $table->json('metadata')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('commerce_order_events')) {
            Schema::create('commerce_order_events', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('commerce_order_id')->constrained()->cascadeOnDelete();
                $table->string('event_type');
                $table->json('payload')->nullable();
                $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('recorded_at')->useCurrent();
                $table->timestamps();
            });
        }
    }
};
