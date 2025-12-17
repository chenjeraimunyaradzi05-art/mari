<?php

use App\Models\SocialProfile;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('social_message_reactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('social_message_id')->constrained('social_messages')->cascadeOnDelete();
            $table->foreignIdFor(SocialProfile::class, 'social_profile_id')->constrained('social_profiles')->cascadeOnDelete();
            $table->string('emoji', 32);
            $table->timestamps();

            $table->unique(['social_message_id', 'social_profile_id', 'emoji'], 'sm_reactions_message_profile_emoji_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('social_message_reactions');
    }
};
