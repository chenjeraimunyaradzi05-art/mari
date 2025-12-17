<?php

use App\Models\Company;
use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_message_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignIdFor(SocialProfile::class, 'owner_social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->foreignIdFor(Company::class)->nullable()->constrained()->nullOnDelete();
            $table->string('visibility', 32)->default('private');
            $table->string('title');
            $table->text('body');
            $table->json('placeholders')->nullable();
            $table->json('usage_metrics')->nullable();
            $table->boolean('is_locked')->default(false);
            $table->boolean('is_default')->default(false);
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['owner_social_profile_id', 'visibility'], 'sm_templates_owner_visibility_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_message_templates');
    }
};
