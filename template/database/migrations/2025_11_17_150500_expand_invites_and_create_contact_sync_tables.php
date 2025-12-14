<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('invites', function (Blueprint $table) {
            $table->foreignId('sender_profile_id')
                ->nullable()
                ->after('sender_id')
                ->constrained('profiles')
                ->nullOnDelete();

            $table->string('channel', 30)->default('email')->after('recipient_phone');
            $table->json('payload')->nullable()->after('message');
            $table->timestamp('accepted_at')->nullable()->after('status');
            $table->foreignId('accepted_user_id')
                ->nullable()
                ->after('accepted_at')
                ->constrained('users')
                ->nullOnDelete();
            $table->string('referral_code', 64)->nullable()->after('token');

            $table->index(['sender_id', 'created_at'], 'invites_sender_created_index');
            $table->index(['token']);
            $table->index(['channel', 'status'], 'invites_channel_status_index');
        });

        Schema::create('contact_sync_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('provider', 40);
            $table->string('status', 40)->default('pending');
            $table->string('state_token', 96)->unique();
            $table->string('auth_url')->nullable();
            $table->unsignedInteger('synced_contacts_count')->default(0);
            $table->json('error_payload')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'provider']);
            $table->index(['status']);
        });

        Schema::create('contact_sync_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('session_id')->constrained('contact_sync_sessions')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('hash', 96);
            $table->string('type', 20);
            $table->foreignId('matched_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->json('metadata')->nullable();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'hash'], 'contact_sync_contacts_user_hash_unique');
            $table->index(['hash'], 'contact_sync_contacts_hash_index');
            $table->index(['matched_user_id']);
            $table->index(['expires_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('contact_sync_contacts');
        Schema::dropIfExists('contact_sync_sessions');

        Schema::table('invites', function (Blueprint $table) {
            $table->dropIndex('invites_sender_created_index');
            $table->dropIndex('invites_token_index');
            $table->dropIndex('invites_channel_status_index');

            $table->dropColumn('referral_code');
            $table->dropForeign(['accepted_user_id']);
            $table->dropColumn('accepted_user_id');
            $table->dropColumn('accepted_at');
            $table->dropColumn('payload');
            $table->dropColumn('channel');
            $table->dropForeign(['sender_profile_id']);
            $table->dropColumn('sender_profile_id');
        });
    }
};
