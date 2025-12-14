<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('community_groups', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('owner_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignId('owner_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->string('tagline')->nullable();
            $table->enum('category', [
                'industry',
                'geographic',
                'program',
                'alumni',
                'mentorship',
                'resource',
            ])->default('industry');
            $table->enum('visibility', ['public', 'private', 'secret'])->default('public');
            $table->enum('access_model', ['open', 'request', 'invite', 'curated'])->default('open');
            $table->json('focus_areas')->nullable();
            $table->string('region_scope')->nullable();
            $table->boolean('requires_verification')->default(false);
            $table->unsignedInteger('member_limit')->nullable();
            $table->unsignedBigInteger('followers_count')->default(0);
            $table->unsignedBigInteger('close_friends_count')->default(0);
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['category', 'visibility']);
        });

        Schema::create('community_chapters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('region_code')->nullable();
            $table->string('timezone')->nullable();
            $table->string('meeting_cadence')->nullable();
            $table->foreignId('chapter_lead_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->unsignedInteger('member_limit')->nullable();
            $table->enum('visibility', ['public', 'private'])->default('public');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['community_group_id', 'slug']);
            $table->index(['region_code', 'visibility']);
        });

        Schema::create('community_roles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->nullable()->constrained('community_groups')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->enum('scope', ['group', 'chapter', 'event'])->default('group');
            $table->unsignedTinyInteger('hierarchy_level')->default(50);
            $table->json('permissions')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();

            $table->unique(['community_group_id', 'slug']);
            $table->index(['scope', 'hierarchy_level']);
        });

        Schema::create('community_memberships', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('community_chapter_id')->nullable()->constrained('community_chapters')->nullOnDelete();
            $table->foreignId('community_role_id')->nullable()->constrained('community_roles')->nullOnDelete();
            $table->foreignId('social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignId('invited_by_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->foreignId('source_follow_id')->nullable()->constrained('social_follows')->nullOnDelete();
            $table->enum('status', ['pending', 'active', 'suspended', 'banned'])->default('pending');
            $table->enum('joined_via', ['organic', 'request', 'invite', 'import', 'program', 'auto_follow'])->default('organic');
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('last_engaged_at')->nullable();
            $table->timestamps();

            $table->unique(['community_group_id', 'social_profile_id'], 'community_memberships_group_profile_unique');
            $table->index(['community_group_id', 'status'], 'community_memberships_group_status_idx');
        });

        Schema::create('community_lists', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('community_chapter_id')->nullable()->constrained('community_chapters')->nullOnDelete();
            $table->foreignId('owner_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->enum('type', ['close_friends', 'spotlight', 'waitlist', 'alumni', 'custom'])->default('custom');
            $table->enum('visibility', ['private', 'members', 'public'])->default('private');
            $table->json('filters')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['community_group_id', 'slug']);
            $table->index(['type', 'visibility']);
        });

        Schema::create('community_list_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_list_id')->constrained('community_lists')->cascadeOnDelete();
            $table->foreignId('social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignId('added_by_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->enum('source', ['manual', 'automation', 'follow_graph', 'import'])->default('manual');
            $table->unsignedInteger('pinned_rank')->nullable();
            $table->timestamps();

            $table->unique(['community_list_id', 'social_profile_id'], 'community_list_entries_list_profile_unique');
        });

        Schema::create('mentorship_cohorts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('community_chapter_id')->nullable()->constrained('community_chapters')->nullOnDelete();
            $table->foreignId('mentorship_program_id')->nullable()->constrained('mentorship_programs')->nullOnDelete();
            $table->foreignId('mentor_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->string('name');
            $table->string('slug');
            $table->string('cohort_code')->nullable();
            $table->string('focus_area')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ends_at')->nullable();
            $table->string('meeting_cadence')->nullable();
            $table->string('timezone')->nullable();
            $table->json('matching_rules')->nullable();
            $table->enum('status', ['draft', 'enrolling', 'active', 'completed', 'archived'])->default('draft');
            $table->timestamps();

            $table->unique(['community_group_id', 'slug']);
        });

        Schema::create('mentorship_cohort_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mentorship_cohort_id')->constrained('mentorship_cohorts')->cascadeOnDelete();
            $table->foreignId('community_membership_id')->nullable()->constrained('community_memberships')->nullOnDelete();
            $table->foreignId('social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->enum('role', ['mentor', 'mentee', 'facilitator'])->default('mentee');
            $table->enum('status', ['invited', 'waitlisted', 'active', 'completed', 'dropped'])->default('invited');
            $table->json('progress')->nullable();
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->unique(['mentorship_cohort_id', 'social_profile_id'], 'mentor_cohort_members_cohort_profile_unique');
        });

        Schema::create('community_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('community_chapter_id')->nullable()->constrained('community_chapters')->nullOnDelete();
            $table->foreignId('mentorship_cohort_id')->nullable()->constrained('mentorship_cohorts')->nullOnDelete();
            $table->foreignId('created_by_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('title');
            $table->string('slug');
            $table->enum('event_type', ['workshop', 'ama', 'meetup', 'live_room', 'cohort_session']);
            $table->enum('format', ['virtual', 'in_person', 'hybrid'])->default('virtual');
            $table->dateTime('starts_at');
            $table->dateTime('ends_at')->nullable();
            $table->string('timezone')->nullable();
            $table->unsignedInteger('capacity')->nullable();
            $table->string('location')->nullable();
            $table->string('stream_url')->nullable();
            $table->json('metadata')->nullable();
            $table->enum('visibility', ['public', 'members', 'invite'])->default('members');
            $table->enum('status', ['draft', 'published', 'completed', 'cancelled'])->default('draft');
            $table->timestamps();

            $table->unique(['community_group_id', 'slug']);
        });

        Schema::create('community_live_rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('community_event_id')->nullable()->constrained('community_events')->nullOnDelete();
            $table->foreignId('host_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('topic');
            $table->enum('room_type', ['audio', 'video'])->default('audio');
            $table->enum('state', ['scheduled', 'live', 'ended'])->default('scheduled');
            $table->unsignedInteger('max_speakers')->default(8);
            $table->unsignedInteger('max_listeners')->default(250);
            $table->dateTime('starts_at')->nullable();
            $table->dateTime('ended_at')->nullable();
            $table->string('recording_path')->nullable();
            $table->json('stage_layout')->nullable();
            $table->timestamps();
        });

        Schema::create('community_resources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('community_chapter_id')->nullable()->constrained('community_chapters')->nullOnDelete();
            $table->foreignId('uploaded_by_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->enum('resource_type', ['guide', 'template', 'recording', 'deck', 'policy', 'link']);
            $table->enum('source_type', ['upload', 'external_link', 'note'])->default('upload');
            $table->string('title');
            $table->string('slug');
            $table->string('disk')->default('public');
            $table->string('file_path')->nullable();
            $table->string('external_url')->nullable();
            $table->json('tags')->nullable();
            $table->enum('visibility', ['public', 'members', 'private'])->default('members');
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['community_group_id', 'slug']);
        });

        Schema::create('community_invites', function (Blueprint $table) {
            $table->id();
            $table->foreignId('community_group_id')->constrained('community_groups')->cascadeOnDelete();
            $table->foreignId('community_chapter_id')->nullable()->constrained('community_chapters')->nullOnDelete();
            $table->foreignId('sender_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignId('recipient_profile_id')->nullable()->constrained('social_profiles')->nullOnDelete();
            $table->string('recipient_email')->nullable();
            $table->string('recipient_phone')->nullable();
            $table->string('token')->unique();
            $table->enum('status', ['pending', 'accepted', 'declined', 'expired'])->default('pending');
            $table->enum('source', ['manual', 'follow_graph', 'import'])->default('manual');
            $table->json('payload')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamp('responded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('community_invites');
        Schema::dropIfExists('community_resources');
        Schema::dropIfExists('community_live_rooms');
        Schema::dropIfExists('community_events');
        Schema::dropIfExists('mentorship_cohort_members');
        Schema::dropIfExists('mentorship_cohorts');
        Schema::dropIfExists('community_list_entries');
        Schema::dropIfExists('community_lists');
        Schema::dropIfExists('community_memberships');
        Schema::dropIfExists('community_roles');
        Schema::dropIfExists('community_chapters');
        Schema::dropIfExists('community_groups');
    }
};
