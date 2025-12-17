<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_graph_contacts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('contact_hash', 96);
            $table->string('full_name', 160)->nullable();
            $table->string('given_name', 120)->nullable();
            $table->string('family_name', 120)->nullable();
            $table->string('email', 160)->nullable();
            $table->string('phone', 60)->nullable();
            $table->string('normalized_email', 160)->nullable();
            $table->string('normalized_phone', 60)->nullable();
            $table->string('source', 40);
            $table->json('tags')->nullable();
            $table->json('context')->nullable();
            $table->unsignedTinyInteger('relationship_strength')->default(50);
            $table->json('metadata')->nullable();
            $table->timestamp('last_interacted_at')->nullable();
            $table->timestamp('last_invited_at')->nullable();
            $table->timestamp('consent_granted_at')->nullable();
            $table->string('consent_method', 40)->nullable();
            $table->string('consent_scope', 120)->nullable();
            $table->string('consent_reference', 160)->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'contact_hash'], 'social_graph_contacts_user_hash_unique');
            $table->index(['user_id', 'last_invited_at'], 'social_graph_contacts_user_invited_index');
            $table->index(['normalized_email']);
            $table->index(['normalized_phone']);
        });

        Schema::table('invites', function (Blueprint $table) {
            if (! Schema::hasColumn('invites', 'graph_contact_id')) {
                $table->foreignId('graph_contact_id')
                    ->nullable()
                    ->after('sender_profile_id')
                    ->constrained('social_graph_contacts')
                    ->nullOnDelete();
            }

            if (! Schema::hasColumn('invites', 'consent_snapshot')) {
                $table->json('consent_snapshot')->nullable()->after('payload');
            }
        });
    }

    public function down(): void
    {
        Schema::table('invites', function (Blueprint $table) {
            if (Schema::hasColumn('invites', 'consent_snapshot')) {
                $table->dropColumn('consent_snapshot');
            }

            if (Schema::hasColumn('invites', 'graph_contact_id')) {
                $table->dropForeign(['graph_contact_id']);
                $table->dropColumn('graph_contact_id');
            }
        });

        Schema::dropIfExists('social_graph_contacts');
    }
};
